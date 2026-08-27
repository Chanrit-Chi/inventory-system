<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'name',
        'contact_person',
        'phone',
        'email',
        'address',
        'lead_time_days',
        'payment_terms',
        'tax_id',
        'notes',
        'is_active',
    ];

    protected $casts = [
        'lead_time_days' => 'integer',
        'is_active'      => 'boolean',
    ];
}
