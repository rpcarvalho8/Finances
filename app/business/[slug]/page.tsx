import LumeuPage from '@/components/BusinessPages/LumeuPage';
import TradePage from '@/components/BusinessPages/TradePage';
import CondoFlowPage from '@/components/BusinessPages/CondoFlowPage';

export const generateStaticParams = async () => {
  // We cannot generate static params because the list of businesses can change.
  // We'll return an empty array to enable dynamic rendering.
  return [];
};

export default function BusinessPage({ params }: { params: { slug: string } }) {
  const { slug } = params;

  // Map slug to the corresponding page component
  const BusinessComponent: React.ComponentType = {
    lumeu: LumeuPage,
    trade: TradePage,
    condoflow: CondoFlowPage,
  }[slug];

  if (!BusinessComponent) {
    // Not found: we could redirect or show a 404
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Negócio não encontrado</h1>
        <p className="text-gray-600">O negócio com o slug "{slug}" não existe.</p>
      </div>
    );
  }

  return <BusinessComponent />;
}