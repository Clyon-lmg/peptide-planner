"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import InventoryAddModal from "@/components/inventory/InventoryAddModal"; // Import the modal
import { useRouter } from "next/navigation";

// (Types derived from your previous code, kept simple for this component)
export default function InventoryActions({ vials, capsules }: { vials: any[], capsules: any[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="flex items-center gap-2">
        <button 
            onClick={() => setShowAdd(true)}
            className="btn bg-primary text-primary-foreground flex items-center gap-2 px-4 py-2"
        >
            <Plus className="size-4" /> Add Item
        </button>
      </div>

      <InventoryAddModal 
        isOpen={showAdd} 
        onClose={() => setShowAdd(false)} 
        onSuccess={() => router.refresh()} 
      />
    </>
  );
}
