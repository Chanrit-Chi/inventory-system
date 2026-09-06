<?php

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\VariantAttributeValue;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $sizeAttr = Attribute::where('code', 'ATTR-SIZE')->orWhere('name', 'Size')->first();
        $colorAttr = Attribute::where('code', 'ATTR-COLOR')->orWhere('name', 'Color')->first();

        if ($sizeAttr && $colorAttr) {
            // Find any "5XL" attribute values misclassified under Color
            $misclassifiedValues = AttributeValue::where('attribute_id', $colorAttr->id)
                ->where(function ($q) {
                    $q->where('value_name', '5XL')->orWhere('value', '5XL');
                })
                ->get();

            foreach ($misclassifiedValues as $val) {
                // Reassign to Size attribute
                $val->update([
                    'attribute_id' => $sizeAttr->id,
                    'is_active' => true,
                ]);
            }

            // Also clean up any corrupted variants on C28 or other products where 5XL was paired as a Color with another Size
            $corruptedVariants = ProductVariant::whereHas('attributeValues', function ($q) use ($sizeAttr) {
                $q->where('attribute_id', $sizeAttr->id)->whereIn('value_name', ['5XL', '5xl']);
            })->whereHas('attributeValues', function ($q) use ($sizeAttr) {
                $q->where('attribute_id', $sizeAttr->id)->whereIn('value_name', ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']);
            })->get();

            foreach ($corruptedVariants as $v) {
                if ($v->stockMovements()->count() === 0 && $v->orderItems()->count() === 0) {
                    $v->variantAttributeValues()->delete();
                    $v->forceDelete();
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No reverse needed for data repair migration
    }
};
