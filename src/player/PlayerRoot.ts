export function preparePlayerRoot(
  app: HTMLElement,
  title: string,
  ...bodyClasses: readonly string[]
): void {
  for (const child of [...document.body.children]) {
    if (child !== app) child.remove();
  }
  document.body.classList.add(...bodyClasses);
  document.title = title;
}
