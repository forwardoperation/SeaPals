export function moveDeckOrderItem(items, fromIndex, toIndex) {
  if (!Array.isArray(items)) return items;
  if (
    !Number.isInteger(fromIndex)
    || !Number.isInteger(toIndex)
    || fromIndex < 0
    || toIndex < 0
    || fromIndex >= items.length
    || toIndex >= items.length
    || fromIndex === toIndex
  ) return items;

  const reordered = [...items];
  const [movedItem] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, movedItem);
  return reordered;
}

export function getDeckOrderDestinationIndex(itemCount, fromIndex, insertionSlot) {
  if (
    !Number.isInteger(itemCount)
    || itemCount < 1
    || !Number.isInteger(fromIndex)
    || fromIndex < 0
    || fromIndex >= itemCount
    || !Number.isInteger(insertionSlot)
    || insertionSlot < 0
    || insertionSlot > itemCount
  ) return fromIndex;

  const destination = insertionSlot > fromIndex ? insertionSlot - 1 : insertionSlot;
  return Math.max(0, Math.min(itemCount - 1, destination));
}
