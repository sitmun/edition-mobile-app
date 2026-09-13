export function applicationListLabel(app: {
  title?: string | null;
  name?: string | null;
}): string {
  const title = app.title?.trim();
  if (title) {
    return title;
  }
  return app.name?.trim() ?? '';
}
