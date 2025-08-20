// app/(app)/inventory/ui/InventoryList.tsx
"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type VialItem = {
  id: number;
  canonical_name: string;
  vials: number;
  mg_per_vial: number;
  bac_ml: number;
};

type CapsuleItem = {
  id: number;
  canonical_name: string;
  bottles: number;
  caps_per_bottle: number;
  mg_per_cap: number;
};

type InventoryListProps = {
  vials: VialItem[];
  capsules: CapsuleItem[];
  onDeleteVial?: (id: number) => void;
  onDeleteCapsule?: (id: number) => void;
};

/**
 * Displays inventory items for vials and capsules.
 * This component no longer imports broken server actions directly.
 * It instead receives data and callbacks from the parent page.
 *
 * Styling follows protocol page conventions:
 *   - Save → blue
 *   - Add → green
 *   - Delete → red
 */
export default function InventoryList({
  vials,
  capsules,
  onDeleteVial,
  onDeleteCapsule,
}: InventoryListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Vials */}
      {vials.map((item) => (
        <Card key={`vial-${item.id}`}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{item.canonical_name}</CardTitle>
            {onDeleteVial && (
              <Button
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => onDeleteVial(item.id)}
              >
                Delete
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <div>Vials: {item.vials}</div>
              <div>mg per vial: {item.mg_per_vial}</div>
              <div>BAC (ml): {item.bac_ml}</div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Capsules */}
      {capsules.map((item) => (
        <Card key={`cap-${item.id}`}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{item.canonical_name}</CardTitle>
            {onDeleteCapsule && (
              <Button
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => onDeleteCapsule(item.id)}
              >
                Delete
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <div>Bottles: {item.bottles}</div>
              <div>Caps/bottle: {item.caps_per_bottle}</div>
              <div>mg per cap: {item.mg_per_cap}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
