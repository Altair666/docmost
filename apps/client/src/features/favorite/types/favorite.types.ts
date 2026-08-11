export type FavoriteType = "page" | "space" | "template";

// Кто завёл страницу или пространство — столбцу «Кем создано»
export type IFavoriteCreator = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type IFavorite = {
  id: string;
  userId: string;
  pageId: string | null;
  spaceId: string | null;
  templateId: string | null;
  type: FavoriteType;
  workspaceId: string;
  createdAt: string;
  page?: {
    id: string;
    slugId: string;
    title: string;
    icon: string | null;
    isBase: boolean;
    spaceId: string;
    creator?: IFavoriteCreator;
  };
  space?: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    creator?: IFavoriteCreator;
  };
  template?: {
    id: string;
    title: string;
    description: string | null;
    icon: string | null;
    spaceId: string | null;
  };
};
