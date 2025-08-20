// app/(app)/cart/PlaceOrderLink.tsx
// Server component — plain anchor to a server redirect (no client JS)
export default function PlaceOrderLink({ vendorId }: { vendorId: number }) {
  const href = `/cart/checkout?vendor_id=${vendorId}&mode=redirect`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="
        inline-flex items-center justify-center
        h-10 px-4 rounded-xl
        bg-primary text-primary-foreground
        hover:opacity-90 transition
        shadow-sm
      "
    >
      Place order
    </a>
  );
}
