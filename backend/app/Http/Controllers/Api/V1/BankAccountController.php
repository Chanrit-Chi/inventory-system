<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\BankAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BankAccountController extends BaseApiController
{
    /**
     * GET /api/v1/bank-accounts
     */
    public function index(Request $request): JsonResponse
    {
        $query = BankAccount::query();

        if (!$request->boolean('include_inactive', false)) {
            $query->where('is_active', true);
        }

        if ($request->has('search') && !empty($request->query('search'))) {
            $term = '%' . $request->query('search') . '%';
            $query->where(function ($q) use ($term) {
                $q->where('bank_name', 'like', $term)
                  ->orWhere('account_name', 'like', $term)
                  ->orWhere('account_number', 'like', $term);
            });
        }

        $accounts = $query->orderByDesc('is_default')->orderBy('bank_name')->get();

        return $this->successResponse($accounts);
    }

    /**
     * POST /api/v1/bank-accounts
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bank_name'      => ['nullable', 'string', 'max:100'],
            'bankName'       => ['nullable', 'string', 'max:100'],
            'account_name'   => ['nullable', 'string', 'max:150'],
            'accountName'    => ['nullable', 'string', 'max:150'],
            'account_number' => ['nullable', 'string', 'max:100'],
            'accountNumber'  => ['nullable', 'string', 'max:100'],
            'qr_image_url'   => ['nullable', 'string'],
            'qrImageUrl'     => ['nullable', 'string'],
            'currency'       => ['nullable', 'string', 'in:USD,KHR,Dual,usd,khr,dual'],
            'is_default'     => ['nullable', 'boolean'],
            'isDefault'      => ['nullable', 'boolean'],
            'is_active'      => ['nullable', 'boolean'],
            'isActive'       => ['nullable', 'boolean'],
            'color'          => ['nullable', 'string', 'max:50'],
            'logo_icon'      => ['nullable', 'string', 'max:50'],
            'logoIcon'       => ['nullable', 'string', 'max:50'],
        ]);

        $bankName = $request->input('bankName') ?? $request->input('bank_name');
        if (empty($bankName)) {
            return $this->badRequestResponse('Bank name is required.');
        }

        $accountName = $request->input('accountName') ?? $request->input('account_name');
        if (empty($accountName)) {
            return $this->badRequestResponse('Account name is required.');
        }

        $accountNumber = $request->input('accountNumber') ?? $request->input('account_number');
        if (empty($accountNumber)) {
            return $this->badRequestResponse('Account number is required.');
        }

        $isDefault = $request->has('isDefault')
            ? $request->boolean('isDefault')
            : ($request->has('is_default') ? $request->boolean('is_default') : false);

        if ($isDefault) {
            BankAccount::where('is_default', true)->update(['is_default' => false]);
        }

        $isActive = $request->has('isActive')
            ? $request->boolean('isActive')
            : ($request->has('is_active') ? $request->boolean('is_active') : true);

        $currency = strtoupper($validated['currency'] ?? 'USD');
        if ($currency === 'DUAL') {
            $currency = 'Dual';
        }

        $account = BankAccount::create([
            'bank_name'      => $bankName,
            'account_name'   => strtoupper(trim($accountName)),
            'account_number' => trim($accountNumber),
            'qr_image_url'   => $request->input('qrImageUrl') ?? $request->input('qr_image_url') ?? null,
            'currency'       => $currency,
            'is_default'     => $isDefault,
            'is_active'      => $isActive,
            'color'          => $validated['color'] ?? '#005F83',
            'logo_icon'      => $request->input('logoIcon') ?? $request->input('logo_icon') ?? 'qr-code',
        ]);

        return $this->createdResponse($account, 'Bank account created successfully.');
    }

    /**
     * GET /api/v1/bank-accounts/{id}
     */
    public function show(string $id): JsonResponse
    {
        $account = BankAccount::find($id);

        if (!$account) {
            return $this->notFoundResponse('Bank account not found.');
        }

        return $this->successResponse($account);
    }

    /**
     * PUT/PATCH /api/v1/bank-accounts/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $account = BankAccount::find($id);

        if (!$account) {
            return $this->notFoundResponse('Bank account not found.');
        }

        $validated = $request->validate([
            'bank_name'      => ['nullable', 'string', 'max:100'],
            'bankName'       => ['nullable', 'string', 'max:100'],
            'account_name'   => ['nullable', 'string', 'max:150'],
            'accountName'    => ['nullable', 'string', 'max:150'],
            'account_number' => ['nullable', 'string', 'max:100'],
            'accountNumber'  => ['nullable', 'string', 'max:100'],
            'qr_image_url'   => ['nullable', 'string'],
            'qrImageUrl'     => ['nullable', 'string'],
            'currency'       => ['nullable', 'string', 'in:USD,KHR,Dual,usd,khr,dual'],
            'is_default'     => ['nullable', 'boolean'],
            'isDefault'      => ['nullable', 'boolean'],
            'is_active'      => ['nullable', 'boolean'],
            'isActive'       => ['nullable', 'boolean'],
            'color'          => ['nullable', 'string', 'max:50'],
            'logo_icon'      => ['nullable', 'string', 'max:50'],
            'logoIcon'       => ['nullable', 'string', 'max:50'],
        ]);

        $updateData = [];
        if ($request->has('bankName') || $request->has('bank_name')) {
            $updateData['bank_name'] = $request->input('bankName') ?? $request->input('bank_name');
        }
        if ($request->has('accountName') || $request->has('account_name')) {
            $updateData['account_name'] = strtoupper(trim($request->input('accountName') ?? $request->input('account_name')));
        }
        if ($request->has('accountNumber') || $request->has('account_number')) {
            $updateData['account_number'] = trim($request->input('accountNumber') ?? $request->input('account_number'));
        }
        if ($request->has('qrImageUrl') || $request->has('qr_image_url')) {
            $updateData['qr_image_url'] = $request->input('qrImageUrl') ?? $request->input('qr_image_url');
        }
        if (isset($validated['currency'])) {
            $c = strtoupper($validated['currency']);
            $updateData['currency'] = $c === 'DUAL' ? 'Dual' : $c;
        }
        if (isset($validated['color'])) {
            $updateData['color'] = $validated['color'];
        }
        if ($request->has('logoIcon') || $request->has('logo_icon')) {
            $updateData['logo_icon'] = $request->input('logoIcon') ?? $request->input('logo_icon');
        }
        if ($request->has('isActive') || $request->has('is_active')) {
            $updateData['is_active'] = $request->has('isActive') ? $request->boolean('isActive') : $request->boolean('is_active');
        }
        if ($request->has('isDefault') || $request->has('is_default')) {
            $isDefault = $request->has('isDefault') ? $request->boolean('isDefault') : $request->boolean('is_default');
            $updateData['is_default'] = $isDefault;
            if ($isDefault) {
                BankAccount::where('id', '!=', $account->id)->where('is_default', true)->update(['is_default' => false]);
            }
        }

        $account->update($updateData);

        return $this->successResponse($account, 'Bank account updated successfully.');
    }

    /**
     * DELETE /api/v1/bank-accounts/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $account = BankAccount::find($id);

        if (!$account) {
            return $this->notFoundResponse('Bank account not found.');
        }

        $account->delete();

        return $this->successResponse(null, 'Bank account deleted successfully.');
    }
}
