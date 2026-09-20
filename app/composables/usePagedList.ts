/**
 * Passé une poignée de lignes, une tuile pousse hors de l'écran tout ce qui la
 * suit : elle n'en montre plus qu'une page (§ 8). Le tri et le filtrage restent
 * à l'appelant — la pagination ne fait que découper.
 */
export function pageCountOf(total: number, perPage: number) {
  return Math.max(1, Math.ceil(total / perPage))
}

export function usePagedList<T>(source: () => T[], perPage: number) {
  const page = ref(1)
  const total = computed(() => source().length)

  /**
   * La liste raccourcit — une décision prise, une charge effacée : la page
   * courante peut passer au-delà de la dernière.
   */
  watch(total, (count) => {
    page.value = Math.min(page.value, pageCountOf(count, perPage))
  })

  const items = computed(() => source().slice((page.value - 1) * perPage, page.value * perPage))

  return reactive({ page, total, items })
}
