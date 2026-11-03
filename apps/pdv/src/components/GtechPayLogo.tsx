type Props = {
  className?: string;
  alt?: string;
};

/** Logo Gtech Pay (arquivo em /public/gtech-pay-logo.jpg) */
export function GtechPayLogo({ className = 'w-28 h-28 mx-auto rounded-2xl object-cover shadow-lg', alt = 'Gtech Pay' }: Props) {
  return <img src={`${import.meta.env.BASE_URL}gtech-pay-logo.jpg`} alt={alt} className={className} />;
}
