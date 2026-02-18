import Link from "next/link";

export default function SuccessPage() {
  return (
    <div className="container flex flex-col gap-4 py-10">
      <h1 className="text-2xl font-semibold">Case is live</h1>
      <p className="text-muted-foreground">
        This page is deprecated. Visit the Case store to open a vault.
      </p>
      <Link href="/" className="text-primary">
        Back to Store
      </Link>
    </div>
  );
}
