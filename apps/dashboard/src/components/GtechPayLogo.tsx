type Props = {
  className?: string;
  alt?: string;
};

export function GtechPayLogo({ className = 'w-28 h-28 mx-auto rounded-2xl object-cover shadow-lg', alt = 'Gtech Pay' }: Props) {
  return <img src={`${import.meta.env.BASE_URL}gtech-pay-logo.jpg`} alt={alt} className={className} />;
}
