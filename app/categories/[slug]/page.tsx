import { CategoryPageApp } from "@/components/CategoryPageApp";
import { sectionTemplates } from "@/lib/reference-data";

type CategoryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  return <CategoryPageApp initialSlug={slug} sectionTemplates={sectionTemplates} />;
}
