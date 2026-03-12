import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Layers } from 'lucide-react';

import { createChildSelectionId, parseSelectionId, pathToString } from '../../types';
import type { ChildItemProps } from './types';

export const ChildItem = memo<ChildItemProps>(
  ({ child, parentObj, selectedObjectId, onSelectObject, onFocusObject, depth }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const childPathStr = pathToString(child.path);
    const parsedSelection = parseSelectionId(selectedObjectId);
    const isChildSelected =
      parsedSelection?.objectId === parentObj.id && parsedSelection.childPath === childPathStr;

    const nestedChildren = useMemo(() => {
      if (!parentObj.children) return [];

      const allPathStrings = new Set(parentObj.children.map((c) => pathToString(c.path)));
      const thisPathStr = pathToString(child.path);

      return parentObj.children.filter((c) => {
        if (c.path.length <= child.path.length) return false;

        for (let i = 0; i < child.path.length; i++) {
          if (c.path[i] !== child.path[i]) return false;
        }

        for (let i = child.path.length + 1; i < c.path.length; i++) {
          const intermediatePath = c.path.slice(0, i);
          const intermediatePathStr = pathToString(intermediatePath);
          if (allPathStrings.has(intermediatePathStr) && intermediatePathStr !== thisPathStr) {
            return false;
          }
        }

        return true;
      });
    }, [parentObj.children, child.path]);

    const hasNestedChildren = nestedChildren.length > 0;

    useEffect(() => {
      if (
        parsedSelection?.objectId === parentObj.id &&
        parsedSelection.childPath &&
        parsedSelection.childPath !== childPathStr
      ) {
        if (parsedSelection.childPath.startsWith(childPathStr + '.')) {
          setIsExpanded(true);
        }
      }
    }, [parsedSelection, parentObj.id, childPathStr]);

    const handleToggleExpand = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const newExpanded = !isExpanded;
        setIsExpanded(newExpanded);

        if (
          !newExpanded &&
          parsedSelection?.objectId === parentObj.id &&
          parsedSelection.childPath &&
          (parsedSelection.childPath.startsWith(childPathStr + '.') ||
            parsedSelection.childPath === childPathStr)
        ) {
          onSelectObject(null);
        }
      },
      [isExpanded, parsedSelection, parentObj.id, childPathStr, onSelectObject]
    );

    const handleChildClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        const childSelectionId = createChildSelectionId(parentObj.id, childPathStr);
        onSelectObject(childSelectionId);
        onFocusObject?.(parentObj, childPathStr, 'explicit');
      },
      [parentObj, childPathStr, onSelectObject, onFocusObject]
    );

    const childSelectionId = createChildSelectionId(parentObj.id, childPathStr);

    return (
      <div className="space-y-0.5">
        <div
          onClick={handleChildClick}
          data-selection-id={childSelectionId}
          className={`
          group flex cursor-pointer items-center gap-2 rounded-[12px] p-2 text-sm transition-all duration-200
          ${
            isChildSelected
              ? 'scale-[1.02] bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
              : 'text-slate-600 hover:scale-[1.01] hover:bg-white/70'
          }
        `}
          style={{ marginLeft: `${depth * 12}px` }}
        >
          {hasNestedChildren ? (
            <button
              onClick={handleToggleExpand}
              className={`
              flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md transition-all duration-200
              ${isChildSelected ? 'text-emerald-100 hover:bg-emerald-400' : 'text-slate-400 hover:bg-slate-100'}
            `}
            >
              <ChevronRight
                size={12}
                className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
              />
            </button>
          ) : (
            <div className="w-5 flex-shrink-0" />
          )}

          <div
            className={`rounded-[8px] p-1 transition-all duration-200 ${
              isChildSelected ? 'bg-emerald-400 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-white'
            }`}
          >
            <Layers size={12} />
          </div>

          <span className="flex-1 truncate text-xs font-medium">{child.name}</span>

          {isChildSelected && <ChevronRight size={12} className="text-emerald-200" />}
        </div>

        {hasNestedChildren && (
          <div
            className={`
            ml-3 space-y-0.5 overflow-hidden border-l-2 border-slate-100 pl-2 transition-all duration-200 ease-out
            ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}
          `}
          >
            {nestedChildren.map((nestedChild) => (
              <ChildItem
                key={pathToString(nestedChild.path)}
                child={nestedChild}
                parentObj={parentObj}
                selectedObjectId={selectedObjectId}
                onSelectObject={onSelectObject}
                onFocusObject={onFocusObject}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);
ChildItem.displayName = 'ChildItem';

