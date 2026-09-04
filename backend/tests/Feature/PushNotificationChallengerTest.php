<?php

namespace Tests\Feature;

use App\Models\PushToken;
use App\Models\User;
use App\Services\PushNotificationService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PushNotificationChallengerTest extends TestCase
{
    use DatabaseMigrations;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }
    }

    // =========================================================================
    // 1. BATCH CHUNKING BOUNDARIES (100, 101, 250, DUPLICATES, EMPTY)
    // =========================================================================

    /**
     * Test exactly 100 tokens produces exactly 1 HTTP request of 100 messages.
     */
    public function test_batch_chunking_exact_100_tokens(): void
    {
        $tokens = [];
        for ($i = 1; $i <= 100; $i++) {
            $tokens[] = "ExponentPushToken[boundary-100-token-{$i}]";
        }

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => function (Request $request) {
                $messages = $request->data();
                $tickets = array_map(function ($msg, $i) {
                    return ['status' => 'ok', 'id' => 'ticket-100-' . $i];
                }, $messages, array_keys($messages));

                return Http::response(['data' => $tickets], 200);
            },
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush($tokens, [
            'title' => 'Exact 100 Test',
            'body' => 'Testing exactly 100 boundary',
        ]);

        // Boundary assertion: exactly 1 HTTP request sent
        Http::assertSentCount(1);

        Http::assertSent(function (Request $request) {
            return count($request->data()) === 100;
        });

        $this->assertEquals(100, $result['sent']);
        $this->assertEquals(0, $result['failed']);
        $this->assertEmpty($result['purged']);
    }

    /**
     * Test boundary at 101 tokens: produces exactly 2 requests (1 of 100 + 1 of 1).
     */
    public function test_batch_chunking_boundary_101_tokens(): void
    {
        $tokens = [];
        for ($i = 1; $i <= 101; $i++) {
            $tokens[] = "ExponentPushToken[boundary-101-token-{$i}]";
        }

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => function (Request $request) {
                $messages = $request->data();
                $tickets = array_map(function ($msg, $i) {
                    return ['status' => 'ok', 'id' => 'ticket-101-' . $i];
                }, $messages, array_keys($messages));

                return Http::response(['data' => $tickets], 200);
            },
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush($tokens, [
            'title' => '101 Boundary Test',
            'body' => 'Testing 100 + 1 boundary chunking',
        ]);

        // Invariant: Exactly 2 HTTP requests sent
        Http::assertSentCount(2);

        // First request has 100 messages
        Http::assertSent(function (Request $request) {
            return count($request->data()) === 100;
        });

        // Second request has 1 message
        Http::assertSent(function (Request $request) {
            return count($request->data()) === 1;
        });

        $this->assertEquals(101, $result['sent']);
        $this->assertEquals(0, $result['failed']);
        $this->assertEmpty($result['purged']);
    }

    /**
     * Test 250 tokens produces exactly 3 requests (100, 100, 50).
     */
    public function test_batch_chunking_multi_chunk_250_tokens(): void
    {
        $tokens = [];
        for ($i = 1; $i <= 250; $i++) {
            $tokens[] = "ExponentPushToken[multi-chunk-250-token-{$i}]";
        }

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => function (Request $request) {
                $messages = $request->data();
                $tickets = array_map(function ($msg, $i) {
                    return ['status' => 'ok', 'id' => 'ticket-250-' . $i];
                }, $messages, array_keys($messages));

                return Http::response(['data' => $tickets], 200);
            },
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush($tokens, [
            'title' => '250 Multi-Chunk Test',
            'body' => 'Testing 100 + 100 + 50 chunks',
        ]);

        // Invariant: Exactly 3 HTTP requests sent
        Http::assertSentCount(3);

        $sentSizes = [];
        Http::assertSent(function (Request $request) use (&$sentSizes) {
            $sentSizes[] = count($request->data());
            return true;
        });

        $this->assertEquals([100, 100, 50], $sentSizes);
        $this->assertEquals(250, $result['sent']);
        $this->assertEquals(0, $result['failed']);
        $this->assertEmpty($result['purged']);
    }

    /**
     * Test deduplication, whitespace stripping, and empty token rejection.
     */
    public function test_batch_chunking_with_duplicate_and_empty_tokens(): void
    {
        $inputTokens = [
            '',
            '   ',
            "\t\n",
            null,
            false,
            12345,
            'ExponentPushToken[dup-token-1]',
            'ExponentPushToken[dup-token-1]',
            'ExponentPushToken[dup-token-1]',
            'ExponentPushToken[dup-token-2]',
            'ExponentPushToken[dup-token-2]',
            'ExponentPushToken[unique-token-alpha]',
            'ExponentPushToken[unique-token-beta]',
        ];

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => function (Request $request) {
                $messages = $request->data();
                $tickets = array_map(function ($msg, $i) {
                    return ['status' => 'ok', 'id' => 'ticket-dedup-' . $i];
                }, $messages, array_keys($messages));

                return Http::response(['data' => $tickets], 200);
            },
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush($inputTokens, [
            'title' => 'Dedup Test',
            'body' => 'Testing deduplication and filter',
        ]);

        // Only 4 unique valid string tokens should be sent
        Http::assertSentCount(1);
        Http::assertSent(function (Request $request) {
            $recipients = collect($request->data())->pluck('to')->all();
            return count($recipients) === 4 &&
                $recipients === [
                    'ExponentPushToken[dup-token-1]',
                    'ExponentPushToken[dup-token-2]',
                    'ExponentPushToken[unique-token-alpha]',
                    'ExponentPushToken[unique-token-beta]',
                ];
        });

        $this->assertEquals(4, $result['sent']);
        $this->assertEquals(0, $result['failed']);
        $this->assertEmpty($result['purged']);
    }

    /**
     * Test that sending only empty or non-string tokens makes zero HTTP calls.
     */
    public function test_send_push_with_only_empty_or_invalid_tokens_skips_network_call(): void
    {
        Http::fake();

        $invalidTokens = ['', '   ', "\t", null, false, 0, 999];

        $service = new PushNotificationService();
        $result = $service->sendPush($invalidTokens, [
            'title' => 'Empty Test',
            'body' => 'Should do nothing',
        ]);

        Http::assertNothingSent();
        $this->assertEquals(0, $result['sent']);
        $this->assertEquals(0, $result['failed']);
        $this->assertEquals([], $result['purged']);
    }

    // =========================================================================
    // 2. DEAD TOKEN PRUNING & TRANSIENT ERROR RETENTION
    // =========================================================================

    /**
     * Test DeviceNotRegistered error triggers immediate deletion of token from push_tokens table.
     */
    public function test_device_not_registered_prunes_token_immediately_from_database(): void
    {
        $user = User::create([
            'name' => 'Prune Target User',
            'email' => 'prune.target@test.com',
            'password' => Hash::make('p'),
            'role' => 'ADMIN',
        ]);

        $validToken = 'ExponentPushToken[alive-token-001]';
        $deadToken1 = 'ExponentPushToken[dead-unregistered-001]';
        $deadToken2 = 'ExponentPushToken[dead-unregistered-002]';

        PushToken::create(['user_id' => $user->id, 'token' => $validToken]);
        PushToken::create(['user_id' => $user->id, 'token' => $deadToken1]);
        PushToken::create(['user_id' => $user->id, 'token' => $deadToken2]);

        $this->assertDatabaseHas('push_tokens', ['token' => $validToken]);
        $this->assertDatabaseHas('push_tokens', ['token' => $deadToken1]);
        $this->assertDatabaseHas('push_tokens', ['token' => $deadToken2]);

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok', 'id' => 't-ok'],
                    [
                        'status' => 'error',
                        'message' => "\"{$deadToken1}\" is not a registered push notification recipient",
                        'details' => ['error' => 'DeviceNotRegistered'],
                    ],
                    [
                        'status' => 'error',
                        'message' => "\"{$deadToken2}\" is not a registered push notification recipient",
                        'details' => ['error' => 'DeviceNotRegistered'],
                    ],
                ],
            ], 200),
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush([$validToken, $deadToken1, $deadToken2], [
            'title' => 'Prune Multi Dead Test',
            'body' => 'Verifying immediate pruning',
        ]);

        $this->assertEquals(1, $result['sent']);
        $this->assertEquals(2, $result['failed']);
        $this->assertEquals([$deadToken1, $deadToken2], $result['purged']);

        // Empirical database verification: alive remains, dead are purged
        $this->assertDatabaseHas('push_tokens', ['token' => $validToken]);
        $this->assertDatabaseMissing('push_tokens', ['token' => $deadToken1]);
        $this->assertDatabaseMissing('push_tokens', ['token' => $deadToken2]);
        $this->assertEquals(1, PushToken::where('user_id', $user->id)->count());
    }

    /**
     * Test DeviceNotRegistered on a token that is not in the database executes gracefully.
     */
    public function test_device_not_registered_for_token_not_in_database_does_not_error(): void
    {
        $nonExistentToken = 'ExponentPushToken[not-in-db-001]';

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    [
                        'status' => 'error',
                        'message' => "\"{$nonExistentToken}\" is not registered",
                        'details' => ['error' => 'DeviceNotRegistered'],
                    ],
                ],
            ], 200),
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush([$nonExistentToken], [
            'title' => 'Non Existent Token Test',
            'body' => 'Should handle gracefully',
        ]);

        $this->assertEquals(0, $result['sent']);
        $this->assertEquals(1, $result['failed']);
        $this->assertEquals([$nonExistentToken], $result['purged']);
    }

    /**
     * Test transient error MessageRateExceeded does NOT delete token from database.
     */
    public function test_transient_error_message_rate_exceeded_retains_token(): void
    {
        $user = User::create([
            'name' => 'Rate User',
            'email' => 'rate.user@test.com',
            'password' => Hash::make('p'),
            'role' => 'MANAGER',
        ]);

        $token = 'ExponentPushToken[transient-rate-limit-token]';
        PushToken::create(['user_id' => $user->id, 'token' => $token]);

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    [
                        'status' => 'error',
                        'message' => 'Rate limit exceeded',
                        'details' => ['error' => 'MessageRateExceeded'],
                    ],
                ],
            ], 200),
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush([$token], [
            'title' => 'Rate Test',
            'body' => 'Testing retention',
        ]);

        $this->assertEquals(0, $result['sent']);
        $this->assertEquals(1, $result['failed']);
        $this->assertEmpty($result['purged']);

        // Invariant: Token must NOT be deleted for transient error
        $this->assertDatabaseHas('push_tokens', ['token' => $token]);
    }

    /**
     * Test transient error MessageTooBig does NOT delete token from database.
     */
    public function test_transient_error_message_too_big_retains_token(): void
    {
        $user = User::create([
            'name' => 'Too Big User',
            'email' => 'toobig@test.com',
            'password' => Hash::make('p'),
            'role' => 'SELLER',
        ]);

        $token = 'ExponentPushToken[transient-message-too-big]';
        PushToken::create(['user_id' => $user->id, 'token' => $token]);

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    [
                        'status' => 'error',
                        'message' => 'Message too big',
                        'details' => ['error' => 'MessageTooBig'],
                    ],
                ],
            ], 200),
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush([$token], [
            'title' => 'Too Big Test',
            'body' => 'Testing retention on payload error',
        ]);

        $this->assertEquals(0, $result['sent']);
        $this->assertEquals(1, $result['failed']);
        $this->assertEmpty($result['purged']);

        // Token must remain intact
        $this->assertDatabaseHas('push_tokens', ['token' => $token]);
    }

    /**
     * Test unknown or custom ticket error retains token in database.
     */
    public function test_unknown_ticket_error_retains_token(): void
    {
        $user = User::create([
            'name' => 'Unknown Error User',
            'email' => 'unknown.error@test.com',
            'password' => Hash::make('p'),
            'role' => 'SELLER',
        ]);

        $token = 'ExponentPushToken[unknown-error-token]';
        PushToken::create(['user_id' => $user->id, 'token' => $token]);

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    [
                        'status' => 'error',
                        'message' => 'Internal Expo Worker Error',
                        'details' => ['error' => 'UnknownServerError'],
                    ],
                ],
            ], 200),
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush([$token], [
            'title' => 'Unknown Error Test',
            'body' => 'Testing retention',
        ]);

        $this->assertEquals(0, $result['sent']);
        $this->assertEquals(1, $result['failed']);
        $this->assertEmpty($result['purged']);

        $this->assertDatabaseHas('push_tokens', ['token' => $token]);
    }

    /**
     * Test dead token pruning across multiple chunks (150 tokens: 100 in chunk 1, 50 in chunk 2).
     */
    public function test_multi_chunk_dead_token_pruning_across_batches(): void
    {
        $user = User::create([
            'name' => 'Multi Chunk User',
            'email' => 'multichunk@test.com',
            'password' => Hash::make('p'),
            'role' => 'ADMIN',
        ]);

        $tokens = [];
        $deadChunk1 = 'ExponentPushToken[multi-dead-chunk1-idx10]';
        $deadChunk2 = 'ExponentPushToken[multi-dead-chunk2-idx120]';

        for ($i = 1; $i <= 150; $i++) {
            if ($i === 10) {
                $token = $deadChunk1;
            } elseif ($i === 120) {
                $token = $deadChunk2;
            } else {
                $token = "ExponentPushToken[multi-alive-token-{$i}]";
            }
            $tokens[] = $token;
            PushToken::create(['user_id' => $user->id, 'token' => $token]);
        }

        $this->assertEquals(150, PushToken::where('user_id', $user->id)->count());

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => function (Request $request) use ($deadChunk1, $deadChunk2) {
                $messages = $request->data();
                $tickets = [];

                foreach ($messages as $idx => $msg) {
                    $recipient = $msg['to'];
                    if ($recipient === $deadChunk1 || $recipient === $deadChunk2) {
                        $tickets[] = [
                            'status' => 'error',
                            'message' => 'Device not registered',
                            'details' => ['error' => 'DeviceNotRegistered'],
                        ];
                    } else {
                        $tickets[] = [
                            'status' => 'ok',
                            'id' => 'ticket-' . $idx,
                        ];
                    }
                }

                return Http::response(['data' => $tickets], 200);
            },
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush($tokens, [
            'title' => 'Multi Chunk Prune Test',
            'body' => 'Testing pruning across chunk boundaries',
        ]);

        Http::assertSentCount(2);
        $this->assertEquals(148, $result['sent']);
        $this->assertEquals(2, $result['failed']);
        $this->assertEquals([$deadChunk1, $deadChunk2], $result['purged']);

        // Verify both dead tokens deleted from DB
        $this->assertDatabaseMissing('push_tokens', ['token' => $deadChunk1]);
        $this->assertDatabaseMissing('push_tokens', ['token' => $deadChunk2]);

        // Remaining count is exactly 148
        $this->assertEquals(148, PushToken::where('user_id', $user->id)->count());
    }

    // =========================================================================
    // 3. HTTP 500, GATEWAY ERRORS & NETWORK TIMEOUT RESILIENCE
    // =========================================================================

    /**
     * Test HTTP 500 Internal Server Error logs and returns failed count without fatal exception.
     */
    public function test_http_500_internal_server_error_handled_gracefully(): void
    {
        $tokens = [
            'ExponentPushToken[server-err-1]',
            'ExponentPushToken[server-err-2]',
            'ExponentPushToken[server-err-3]',
        ];

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'errors' => [['message' => 'Internal Server Error', 'code' => 'INTERNAL_SERVER_ERROR']],
            ], 500),
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush($tokens, [
            'title' => '500 Test',
            'body' => 'Should survive 500',
        ]);

        $this->assertEquals(0, $result['sent']);
        $this->assertEquals(3, $result['failed']);
        $this->assertEmpty($result['purged']);
    }

    /**
     * Test HTTP 502 Bad Gateway and 503 Service Unavailable are handled gracefully.
     */
    public function test_http_502_and_503_gateway_errors_handled_gracefully(): void
    {
        Http::fakeSequence()
            ->push('Bad Gateway', 502)
            ->push('Service Unavailable', 503);

        $tokens = ['ExponentPushToken[gw-tok-1]', 'ExponentPushToken[gw-tok-2]'];

        $service = new PushNotificationService();

        // Call 1: 502 Bad Gateway
        $res1 = $service->sendPush($tokens, ['title' => '502 Test', 'body' => 'Testing 502']);
        $this->assertEquals(0, $res1['sent']);
        $this->assertEquals(2, $res1['failed']);

        // Call 2: 503 Service Unavailable
        $res2 = $service->sendPush($tokens, ['title' => '503 Test', 'body' => 'Testing 503']);
        $this->assertEquals(0, $res2['sent']);
        $this->assertEquals(2, $res2['failed']);
    }

    /**
     * Test ConnectionException (cURL timeout) is caught and handled gracefully without unhandled throw.
     */
    public function test_connection_timeout_exception_handled_gracefully(): void
    {
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => function () {
                throw new ConnectionException('cURL error 28: Connection timed out after 10001 milliseconds');
            },
        ]);

        $tokens = ['ExponentPushToken[timeout-tok-1]', 'ExponentPushToken[timeout-tok-2]'];

        $service = new PushNotificationService();
        $result = $service->sendPush($tokens, [
            'title' => 'Timeout Test',
            'body' => 'Testing timeout resilience',
        ]);

        $this->assertEquals(0, $result['sent']);
        $this->assertEquals(2, $result['failed']);
        $this->assertEmpty($result['purged']);
    }

    /**
     * Test mixed chunk resilience: Chunk 1 fails with HTTP 500, Chunk 2 succeeds with HTTP 200.
     * Business requirement: A partial gateway failure must not abort subsequent batch chunks.
     */
    public function test_mixed_chunk_resilience_one_chunk_fails_500_other_chunk_succeeds(): void
    {
        $tokens = [];
        for ($i = 1; $i <= 200; $i++) {
            $tokens[] = "ExponentPushToken[mixed-chunk-{$i}]";
        }

        // Chunk 1 (tokens 1..100) returns 500; Chunk 2 (tokens 101..200) returns 200 OK
        Http::fakeSequence()
            ->push(['errors' => ['Temporary database glitch']], 500)
            ->push([
                'data' => array_fill(0, 100, ['status' => 'ok', 'id' => 't-ok']),
            ], 200);

        $service = new PushNotificationService();
        $result = $service->sendPush($tokens, [
            'title' => 'Mixed Chunks Test',
            'body' => 'Testing independent chunk execution',
        ]);

        Http::assertSentCount(2);

        // Invariant: Chunk 2 must still succeed despite Chunk 1 failing with HTTP 500
        $this->assertEquals(100, $result['sent']);
        $this->assertEquals(100, $result['failed']);
        $this->assertEmpty($result['purged']);
    }

    /**
     * Test mixed chunk resilience: Chunk 1 times out (ConnectionException), Chunk 2 succeeds.
     */
    public function test_mixed_chunk_resilience_one_chunk_times_out_other_chunk_succeeds(): void
    {
        $tokens = [];
        for ($i = 1; $i <= 200; $i++) {
            $tokens[] = "ExponentPushToken[mixed-timeout-chunk-{$i}]";
        }

        $callCount = 0;
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => function () use (&$callCount) {
                $callCount++;
                if ($callCount === 1) {
                    throw new ConnectionException('cURL timeout on chunk 1');
                }
                return Http::response([
                    'data' => array_fill(0, 100, ['status' => 'ok', 'id' => 't-ok']),
                ], 200);
            },
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush($tokens, [
            'title' => 'Timeout + Success Test',
            'body' => 'Testing recovery after timeout chunk',
        ]);

        $this->assertEquals(2, $callCount);
        $this->assertEquals(100, $result['sent']);
        $this->assertEquals(100, $result['failed']);
        $this->assertEmpty($result['purged']);
    }

    /**
     * Test HTTP 200 with malformed JSON or missing 'data' array.
     */
    public function test_http_200_with_missing_data_structure_handles_gracefully(): void
    {
        $tokens = ['ExponentPushToken[malformed-tok-1]', 'ExponentPushToken[malformed-tok-2]'];

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'unexpected_key' => 'something',
            ], 200),
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush($tokens, [
            'title' => 'Malformed Response Test',
            'body' => 'Testing missing data key',
        ]);

        $this->assertEquals(0, $result['sent']);
        $this->assertEquals(2, $result['failed']);
        $this->assertEmpty($result['purged']);
    }

    /**
     * Test optional Authorization Bearer header is added when Expo Access Token is configured.
     */
    public function test_authorization_header_sent_when_access_token_is_configured(): void
    {
        $token = 'ExponentPushToken[bearer-test-token]';

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [['status' => 'ok', 'id' => 't-bearer']],
            ], 200),
        ]);

        $service = new PushNotificationService('https://exp.host/--/api/v2/push/send', 'my-secret-expo-token-xyz');
        $result = $service->sendPush([$token], [
            'title' => 'Bearer Test',
            'body' => 'Testing Bearer header',
        ]);

        $this->assertEquals(1, $result['sent']);

        Http::assertSent(function (Request $request) {
            return $request->hasHeader('Authorization', 'Bearer my-secret-expo-token-xyz');
        });
    }

    /**
     * Test payload attributes formatting: priority, channelId, badge, sound.
     */
    public function test_payload_attributes_are_correctly_mapped_to_expo_messages(): void
    {
        $token = 'ExponentPushToken[payload-test-token]';

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [['status' => 'ok', 'id' => 't-payload']],
            ], 200),
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush([$token], [
            'title' => 'Custom Title',
            'body' => 'Custom Body',
            'data' => ['order_id' => '123', 'action' => 'open'],
            'sound' => 'alert.wav',
            'priority' => 'high',
            'channelId' => 'orders-channel',
            'badge' => 5,
        ]);

        $this->assertEquals(1, $result['sent']);

        Http::assertSent(function (Request $request) use ($token) {
            $msg = $request->data()[0];
            return $msg['to'] === $token &&
                $msg['title'] === 'Custom Title' &&
                $msg['body'] === 'Custom Body' &&
                $msg['sound'] === 'alert.wav' &&
                $msg['priority'] === 'high' &&
                $msg['channelId'] === 'orders-channel' &&
                $msg['badge'] === 5 &&
                $msg['data']['order_id'] === '123';
        });
    }
}
