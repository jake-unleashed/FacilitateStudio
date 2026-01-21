import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Box, ChevronRight } from 'lucide-react';

import { OBJECT_ICONS } from '../../constants';
import { parseSelectionId, pathToString } from '../../types';
import type { HierarchyItemProps } from './types';
import { ChildItem } from './ChildItem';

export const HierarchyItem = memo<HierarchyItemProps>(({ obj, selectedObjectId, onSelectObject, onFocusObject }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = OBJECT_ICONS[obj.type] || Box;
  const hasChildren = obj.children && obj.children.length > 0;

  const parsedSelection = parseSelectionId(selectedObjectId);
  const isParentSelected = parsedSelection?.objectId === obj.id && parsedSelection.childPath === null;
  const isAnyChildSelected = parsedSelection?.objectId === obj.id && parsedSelection.childPath !== null;

  const directChildren = useMemo(() => {
    if (!obj.children || obj.children.length === 0) return [];

    const allPathStrings = new Set(obj.children.map((c) => pathToString(c.path)));

    return obj.children.filter((child) => {
      for (let i = 1; i < child.path.length; i++) {
        const prefixPath = child.path.slice(0, i);
        const prefixPathStr = pathToString(prefixPath);
        if (allPathStrings.has(prefixPathStr)) return false;
      }
      return true;
    });
  }, [obj.children]);

  useEffect(() => {
    if (isAnyChildSelected && parsedSelection?.childPath && !isExpanded) {
      setIsExpanded(true);
    }
  }, [isAnyChildSelected, parsedSelection?.childPath, isExpanded]);

  const handleParentClick = useCallback(() => {
    onSelectObject(obj.id);
    onFocusObject?.(obj);
  }, [obj, onSelectObject, onFocusObject]);

  const handleToggleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const newExpanded = !isExpanded;
      setIsExpanded(newExpanded);
      if (!newExpanded && isAnyChildSelected) {
        onSelectObject(null);
      }
    },
    [isExpanded, isAnyChildSelected, onSelectObject]
  );

  return (
    <div className="space-y-0.5">
      <div
        onClick={handleParentClick}
        data-selection-id={obj.id}
        className={`
          group flex cursor-pointer items-center gap-2 rounded-[16px] p-2.5 text-sm transition-all duration-200
          ${
            isParentSelected
              ? 'scale-[1.02] bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : isAnyChildSelected
                ? 'bg-blue-50 text-slate-800'
                : 'text-slate-700 hover:scale-[1.01] hover:bg-white/60'
          }
        `}
      >
        {hasChildren && directChildren.length > 0 ? (
          <button
            onClick={handleToggleExpand}
            className={`
              flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition-all duration-200
              ${isParentSelected ? 'text-blue-100 hover:bg-blue-500' : 'text-slate-400 hover:bg-slate-100'}
            `}
          >
            <ChevronRight
              size={14}
              className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
            />
          </button>
        ) : (
          <div className="w-6 flex-shrink-0" />
        )}

        <div
          className={`rounded-[10px] p-1.5 transition-all duration-200 ${
            isParentSelected ? 'bg-blue-500 text-white' : 'bg-white text-slate-400 shadow-sm group-hover:shadow'
          }`}
        >
          <Icon size={14} />
        </div>

        <span className="flex-1 truncate font-medium">{obj.name}</span>
      </div>

      {hasChildren && directChildren.length > 0 && (
        <div
          className={`
            ml-3 space-y-0.5 overflow-hidden border-l-2 border-slate-100 pl-2 transition-all duration-200 ease-out
            ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
          `}
        >
          {directChildren.map((child) => (
            <ChildItem
              key={pathToString(child.path)}
              child={child}
              parentObj={obj}
              selectedObjectId={selectedObjectId}
              onSelectObject={onSelectObject}
              onFocusObject={onFocusObject}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
});
HierarchyItem.displayName = 'HierarchyItem';

