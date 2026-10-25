export async function generateMetadata({ params }: { params: { slug: string } }) {
  return { title: params.slug };
}

export default function Page({ params }: { params: { slug: string } }) {
  return <h1>{params.slug}</h1>;
}
