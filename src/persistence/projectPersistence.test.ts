import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LocalStorageProjectPersistence,
  upsertProject,
  removeProject,
  PROJECTS_STORAGE_KEY,
} from './projectPersistence';
import type { Project } from '../types/project';

describe('projectPersistence', () => {
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    mockLocalStorage = {};

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: vi.fn(() => {
        mockLocalStorage = {};
      }),
      length: 0,
      key: vi.fn(() => null),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('upsertProject', () => {
    it('should add a new project to empty list', () => {
      const project: Project = {
        id: 'test-id',
        name: 'Test Project',
        objects: [],
        steps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = upsertProject([], project);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-id');
      expect(result[0].updatedAt).toBeDefined();
    });

    it('should update existing project', () => {
      const original: Project = {
        id: 'test-id',
        name: 'Original Name',
        objects: [],
        steps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updated: Project = {
        ...original,
        name: 'Updated Name',
      };

      const result = upsertProject([original], updated);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Updated Name');
    });

    it('should sort projects by most recently updated', () => {
      const old: Project = {
        id: 'old',
        name: 'Old',
        objects: [],
        steps: [],
        createdAt: new Date('2020-01-01').toISOString(),
        updatedAt: new Date('2020-01-01').toISOString(),
      };

      const newer: Project = {
        id: 'new',
        name: 'New',
        objects: [],
        steps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = upsertProject([old], newer);

      expect(result[0].id).toBe('new');
      expect(result[1].id).toBe('old');
    });
  });

  describe('removeProject', () => {
    it('should remove project by id', () => {
      const projects: Project[] = [
        {
          id: 'id-1',
          name: 'Project 1',
          objects: [],
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'id-2',
          name: 'Project 2',
          objects: [],
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const result = removeProject(projects, 'id-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('id-2');
    });

    it('should handle removing non-existent project', () => {
      const projects: Project[] = [
        {
          id: 'id-1',
          name: 'Project 1',
          objects: [],
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const result = removeProject(projects, 'non-existent');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('id-1');
    });
  });

  describe('LocalStorageProjectPersistence', () => {
    let persistence: LocalStorageProjectPersistence;

    beforeEach(() => {
      persistence = new LocalStorageProjectPersistence();
    });

    describe('saveProjects', () => {
      it('should save projects to localStorage', () => {
        const projects: Project[] = [
          {
            id: 'test-id',
            name: 'Test Project',
            objects: [],
            steps: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

        persistence.saveProjects(projects);

        expect(localStorage.setItem).toHaveBeenCalledWith(
          PROJECTS_STORAGE_KEY,
          expect.any(String),
        );

        const savedData = JSON.parse(mockLocalStorage[PROJECTS_STORAGE_KEY]);
        expect(savedData).toHaveLength(1);
        expect(savedData[0].id).toBe('test-id');
      });

      it('should save multiple projects', () => {
        const projects: Project[] = [
          {
            id: 'id-1',
            name: 'Project 1',
            objects: [],
            steps: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'id-2',
            name: 'Project 2',
            objects: [],
            steps: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

        persistence.saveProjects(projects);

        const savedData = JSON.parse(mockLocalStorage[PROJECTS_STORAGE_KEY]);
        expect(savedData).toHaveLength(2);
      });

      it('should handle empty projects array', () => {
        persistence.saveProjects([]);

        const savedData = JSON.parse(mockLocalStorage[PROJECTS_STORAGE_KEY]);
        expect(savedData).toEqual([]);
      });
    });

    describe('loadProjects', () => {
      it('should load projects from localStorage', () => {
        const projects: Project[] = [
          {
            id: 'id-1',
            name: 'Project 1',
            objects: [],
            steps: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date('2024-01-02').toISOString(),
          },
          {
            id: 'id-2',
            name: 'Project 2',
            objects: [],
            steps: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date('2024-01-01').toISOString(),
          },
        ];

        mockLocalStorage[PROJECTS_STORAGE_KEY] = JSON.stringify(projects);

        const loaded = persistence.loadProjects();

        expect(loaded).toHaveLength(2);
        expect(loaded[0].id).toBe('id-1'); // More recent
        expect(loaded[1].id).toBe('id-2');
        expect(localStorage.getItem).toHaveBeenCalledWith(PROJECTS_STORAGE_KEY);
      });

      it('should return empty array when no projects exist', () => {
        const loaded = persistence.loadProjects();

        expect(loaded).toEqual([]);
      });

      it('should handle invalid JSON gracefully', () => {
        mockLocalStorage[PROJECTS_STORAGE_KEY] = 'invalid json';

        expect(() => persistence.loadProjects()).toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle projects with thumbnails', () => {
        const projects: Project[] = [
          {
            id: 'thumb-id',
            name: 'Project with Thumbnail',
            objects: [],
            steps: [],
            thumbnail:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

        persistence.saveProjects(projects);

        const loaded = persistence.loadProjects();
        expect(loaded).toHaveLength(1);
        expect(loaded[0].thumbnail).toBe(projects[0].thumbnail);
      });

      it('should handle special characters in project names', () => {
        const projects: Project[] = [
          {
            id: 'special-id',
            name: 'Project with "quotes" and \'apostrophes\' and <tags> & symbols!',
            objects: [],
            steps: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

        persistence.saveProjects(projects);

        const loaded = persistence.loadProjects();
        expect(loaded[0].name).toBe(projects[0].name);
      });

      it('should handle very large projects', () => {
        const largeProjects: Project[] = [
          {
            id: 'large-id',
            name: 'Large Project',
            objects: Array.from({ length: 100 }, (_, i) => ({
              id: `obj-${i}`,
              type: 'mesh' as const,
              name: `Cube ${i}`,
              transform: {
                x: i,
                y: i,
                z: i,
                rotationX: 0,
                rotationY: 0,
                rotationZ: 0,
                scaleX: 1,
                scaleY: 1,
                scaleZ: 1,
              },
              properties: {
                visible: true,
                color: '#3b82f6',
              },
            })),
            steps: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

        persistence.saveProjects(largeProjects);

        const loaded = persistence.loadProjects();
        expect(loaded).toHaveLength(1);
        expect(loaded[0].objects).toHaveLength(100);
      });
    });
  });
});
