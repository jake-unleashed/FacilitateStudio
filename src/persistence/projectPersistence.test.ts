import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  LocalStorageProjectPersistence,
  IndexedDBProjectPersistence,
  createProjectPersistence,
  clearIndexedDbProjectsStore,
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

        expect(localStorage.setItem).toHaveBeenCalledWith(PROJECTS_STORAGE_KEY, expect.any(String));

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

        expect(persistence.loadProjects()).toEqual([]);
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

  describe('IndexedDBProjectPersistence', () => {
    let persistence: IndexedDBProjectPersistence;

    beforeEach(() => {
      persistence = createProjectPersistence();
    });

    describe('initialization', () => {
      it('should create persistence instance', () => {
        expect(persistence).toBeInstanceOf(IndexedDBProjectPersistence);
      });

      it('should initialize without errors', async () => {
        await expect(persistence.initialize()).resolves.not.toThrow();
      });
    });

    describe('CRUD operations', () => {
      it('should save and load a project', async () => {
        const project: Project = {
          id: 'test-idb-id',
          name: 'IndexedDB Test Project',
          objects: [],
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await persistence.saveProject(project);
        const loaded = await persistence.getProject('test-idb-id');

        expect(loaded).toBeDefined();
        expect(loaded?.id).toBe('test-idb-id');
        expect(loaded?.name).toBe('IndexedDB Test Project');
      });

      it('should load all projects', async () => {
        const project1: Project = {
          id: 'proj-1',
          name: 'Project 1',
          objects: [],
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date('2024-01-02').toISOString(),
        };
        const project2: Project = {
          id: 'proj-2',
          name: 'Project 2',
          objects: [],
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date('2024-01-01').toISOString(),
        };

        await persistence.saveProject(project1);
        await persistence.saveProject(project2);

        const loaded = await persistence.loadProjects();
        expect(loaded.length).toBeGreaterThanOrEqual(2);
      });

      it('should delete a project', async () => {
        const project: Project = {
          id: 'to-delete',
          name: 'Will be deleted',
          objects: [],
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await persistence.saveProject(project);
        let loaded = await persistence.getProject('to-delete');
        expect(loaded).toBeDefined();

        await persistence.deleteProject('to-delete');
        loaded = await persistence.getProject('to-delete');
        expect(loaded).toBeUndefined();
      });

      it('clearIndexedDbProjectsStore clears legacy shared projects store', async () => {
        await persistence.saveProject({
          id: 'legacy-1',
          name: 'Legacy Project',
          objects: [],
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        expect((await persistence.loadProjects()).length).toBeGreaterThan(0);

        await clearIndexedDbProjectsStore();
        const loadedAfterClear = await persistence.loadProjects();
        expect(loadedAfterClear).toEqual([]);
      });

      it('should update existing project', async () => {
        const project: Project = {
          id: 'update-test',
          name: 'Original Name',
          objects: [],
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await persistence.saveProject(project);

        const updated: Project = {
          ...project,
          name: 'Updated Name',
        };

        await persistence.saveProject(updated);

        const loaded = await persistence.getProject('update-test');
        expect(loaded?.name).toBe('Updated Name');
      });
    });

    describe('saveProjects (bulk)', () => {
      it('should replace all projects', async () => {
        // First save some projects individually
        await persistence.saveProject({
          id: 'old-1',
          name: 'Old 1',
          objects: [],
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Now bulk save different projects
        const newProjects: Project[] = [
          {
            id: 'new-1',
            name: 'New 1',
            objects: [],
            steps: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'new-2',
            name: 'New 2',
            objects: [],
            steps: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

        await persistence.saveProjects(newProjects);

        const loaded = await persistence.loadProjects();
        expect(loaded).toHaveLength(2);
        expect(loaded.map((p) => p.id)).toContain('new-1');
        expect(loaded.map((p) => p.id)).toContain('new-2');
        expect(loaded.map((p) => p.id)).not.toContain('old-1');
      });
    });

    describe('edge cases', () => {
      it('should return undefined for non-existent project', async () => {
        const loaded = await persistence.getProject('does-not-exist');
        expect(loaded).toBeUndefined();
      });

      it('should handle deleting non-existent project', async () => {
        await expect(persistence.deleteProject('does-not-exist')).resolves.not.toThrow();
      });

      it('should handle empty projects array', async () => {
        await persistence.saveProjects([]);
        const loaded = await persistence.loadProjects();
        expect(loaded).toEqual([]);
      });
    });
  });
});
