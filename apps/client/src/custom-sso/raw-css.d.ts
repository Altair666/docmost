// Vite умеет отдавать файл текстом через ?raw. Объявляем явно, чтобы не
// зависеть от того, подключены ли в проекте типы vite/client.
declare module "*.css?raw" {
  const content: string;
  export default content;
}
