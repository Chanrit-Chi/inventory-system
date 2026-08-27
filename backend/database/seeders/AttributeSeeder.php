<?php

namespace Database\Seeders;

use App\Models\Attribute;
use App\Models\AttributeValue;
use Illuminate\Database\Seeder;

class AttributeSeeder extends Seeder
{
    public function run(): void
    {
        $attributeMatrix = [
            'Size' => [
                'code' => 'ATTR-SIZE',
                'description' => 'Standard garment and product sizing',
                'values' => [
                    ['value' => 'S', 'code' => 'SIZE-S'],
                    ['value' => 'M', 'code' => 'SIZE-M'],
                    ['value' => 'L', 'code' => 'SIZE-L'],
                    ['value' => 'XL', 'code' => 'SIZE-XL'],
                ],
            ],
            'Color' => [
                'code' => 'ATTR-COLOR',
                'description' => 'Color shade variants',
                'values' => [
                    ['value' => 'Black', 'code' => 'COLOR-BLACK'],
                    ['value' => 'White', 'code' => 'COLOR-WHITE'],
                    ['value' => 'Navy Blue', 'code' => 'COLOR-NAVY'],
                    ['value' => 'Crimson Red', 'code' => 'COLOR-RED'],
                ],
            ],
            'Storage Capacity' => [
                'code' => 'ATTR-STORAGE',
                'description' => 'Memory or storage capacity for electronics',
                'values' => [
                    ['value' => '64GB', 'code' => 'STORAGE-64G'],
                    ['value' => '128GB', 'code' => 'STORAGE-128G'],
                    ['value' => '256GB', 'code' => 'STORAGE-256G'],
                ],
            ],
        ];

        foreach ($attributeMatrix as $attrName => $attrData) {
            $attribute = Attribute::firstOrCreate(
                ['name' => $attrName],
                [
                    'code' => $attrData['code'],
                    'description' => $attrData['description'],
                    'is_active' => true,
                ]
            );

            foreach ($attrData['values'] as $valData) {
                AttributeValue::firstOrCreate(
                    [
                        'attribute_id' => $attribute->id,
                        'value_name' => $valData['value'],
                    ],
                    [
                        'value' => $valData['value'],
                        'code' => $valData['code'],
                        'is_active' => true,
                    ]
                );
            }
        }
    }
}
