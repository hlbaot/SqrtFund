import { useLocale } from "@/lib/context/locale";

export function NotificationBadge({ count }: { count: number }) {
  const { t } = useLocale();
  if (count <= 0) return null;
  return (
    <span aria-label={`${t.wallet.notifications}: ${count}`} className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 font-mono text-xs leading-none tracking-normal text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}
