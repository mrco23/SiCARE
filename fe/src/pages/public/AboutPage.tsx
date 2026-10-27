import { AboutHero, CtaSection, FokusLayanan, PrinsipLayanan, VisiMisi } from "../../components/public/about/AboutSections";

export default function AboutPage() {
  return (
    <div className="overflow-x-clip bg-white">
      <AboutHero />
      <VisiMisi />
      <FokusLayanan />
      <PrinsipLayanan />
      <CtaSection />
    </div>
  );
}
