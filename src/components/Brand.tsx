import Link from "next/link";
import { AureliLogo } from "./AureliLogo";

type BrandProps = {
  href?: string;
  tagline?: string;
};

export function Brand({
  href = "/",
  tagline = "Your AI finance team",
}: BrandProps) {
  return (
    <Link
      href={href}
      className="brand"
      style={{
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <AureliLogo size={34} showWordmark tagline={tagline} />
    </Link>
  );
}

export default Brand;