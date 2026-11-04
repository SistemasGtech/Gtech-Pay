type Props = {
  className?: string;
  alt?: string;
};

/** Logo quadrado recortado (512px) — ver scripts/generate-android-icons.ps1 */
export function GtechPayLogo({ className = 'w-28 h-28 mx-auto rounded-2xl object-contain shadow-lg ring-1 ring-cyan-500/20 bg-[#0a1628]', alt = 'Gtech Pay' }: Props) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}gtech-pay-icon-square.png`}
      alt={alt}
      className={className}
      width={512}
      height={512}
      decoding="async"
    />
  );
}
