import { ChevronDown, ChevronRight, FolderTree, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CategoryNode } from '../types/iperal';

interface CategorySidebarProps {
  categories: CategoryNode[];
  selectedCategoryId: number | null;
  onSelectCategory: (category: CategoryNode) => void;
  loading: boolean;
}

function filterTree(nodes: CategoryNode[], query: string): CategoryNode[] {
  if (!query.trim()) return nodes;
  const q = query.trim().toLowerCase();

  const result: CategoryNode[] = [];
  for (const node of nodes) {
    const filteredChildren = filterTree(node.children || [], q);
    if (node.name.toLowerCase().includes(q) || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: filteredChildren,
      });
    }
  }
  return result;
}

interface TreeRowProps {
  node: CategoryNode;
  depth: number;
  selectedId: number | null;
  expandedIds: Set<number>;
  forceExpand: boolean;
  onToggleExpand: (id: number) => void;
  onSelect: (category: CategoryNode) => void;
}

function TreeRow({
  node,
  depth,
  selectedId,
  expandedIds,
  forceExpand,
  onToggleExpand,
  onSelect,
}: TreeRowProps) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isExpanded = forceExpand || expandedIds.has(node.categoryId);
  const isSelected = selectedId === node.categoryId;

  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-lg transition-colors duration-150 ${
          isSelected
            ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
        }`}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpand(node.categoryId)}
            aria-label={isExpanded ? `Comprimi ${node.name}` : `Espandi ${node.name}`}
            className="flex h-8 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="w-6 shrink-0" aria-hidden="true" />
        )}

        <button
          type="button"
          onClick={() => {
            onSelect(node);
            if (hasChildren && !expandedIds.has(node.categoryId)) {
              onToggleExpand(node.categoryId);
            }
          }}
          className={`flex min-h-[36px] flex-1 cursor-pointer items-center justify-between gap-2 py-1.5 pr-2.5 text-left text-sm leading-snug ${
            isSelected ? 'font-semibold' : 'font-normal'
          }`}
        >
          <span className="line-clamp-2">{node.name}</span>
          {hasChildren && (
            <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
              {node.children.length}
            </span>
          )}
        </button>
      </div>

      {hasChildren && isExpanded && (
        <ul className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <TreeRow
              key={child.categoryId}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              forceExpand={forceExpand}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  loading,
}: CategorySidebarProps) {
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  const filteredCategories = useMemo(
    () => filterTree(categories, search),
    [categories, search],
  );

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <aside className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 lg:h-[calc(100vh-6.5rem)]">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <FolderTree className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Reparti Iperal</h2>
        </div>
        {categories.length > 0 && (
          <span className="text-xs tabular-nums text-[var(--text-muted)]">
            {categories.length} sezioni
          </span>
        )}
      </div>

      <div className="relative mb-3 shrink-0">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca reparto o sottocategoria..."
          aria-label="Cerca reparto"
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] py-2 pr-8 pl-8 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Cancella ricerca reparto"
            className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {loading ? (
        <div
          className="flex-1 space-y-2 overflow-y-auto py-2"
          aria-busy="true"
          aria-label="Caricamento categorie"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
            <div
              key={idx}
              className="h-8 animate-pulse rounded-lg bg-[var(--surface-subtle)]"
            />
          ))}
        </div>
      ) : filteredCategories.length === 0 ? (
        <p className="py-6 text-center text-xs text-[var(--text-muted)]">
          {categories.length === 0
            ? 'Nessuna categoria disponibile. Verifica la sessione.'
            : 'Nessun reparto corrisponde alla ricerca.'}
        </p>
      ) : (
        <ul className="max-h-[55vh] flex-1 space-y-0.5 overflow-y-auto pr-1 lg:max-h-none">
          {filteredCategories.map((node) => (
            <TreeRow
              key={node.categoryId}
              node={node}
              depth={0}
              selectedId={selectedCategoryId}
              expandedIds={expandedIds}
              forceExpand={Boolean(search.trim())}
              onToggleExpand={toggleExpand}
              onSelect={onSelectCategory}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}
