import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query";
import { PageByline } from "@/features/editor/full-editor";

// Строка автора для верхней строки страницы: кто создал, подробности и
// значок проверки. Прежде она стояла под заголовком.
//
// Данные берём сами — верхняя строка их не получает.
export default function PageBylineTop({ readOnly }: { readOnly?: boolean }) {
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  if (!page) return null;

  return (
    <PageByline
      creator={page.creator}
      contributors={page.contributors}
      readOnly={readOnly}
    />
  );
}
