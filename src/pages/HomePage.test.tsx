import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './HomePage';
import { ProjectMetadata } from '../types/project';

const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: null,
    isLoading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: mockSignOut,
  }),
}));

vi.mock('../contexts/PopupContext', () => ({
  usePopup: () => ({
    popup: null,
    showPopup: vi.fn(),
    dismissPopup: vi.fn(),
  }),
}));

const { mockResolveThumbnailUrl } = vi.hoisted(() => ({
  mockResolveThumbnailUrl: vi.fn<() => Promise<string | undefined>>(),
}));
vi.mock('../utils/thumbnailUpload', async () => {
  const actual = await vi.importActual<typeof import('../utils/thumbnailUpload')>(
    '../utils/thumbnailUpload'
  );
  return {
    ...actual,
    resolveThumbnailUrl: mockResolveThumbnailUrl,
  };
});

// Mock useProjects hook
const mockDeleteProject = vi.fn().mockResolvedValue(undefined);
const mockGetProjectMetadata = vi.fn<() => ProjectMetadata[]>();
const mockSaveProject = vi.fn();
let mockIsLoading = false;
let mockIsSyncing = false;
const mockClearError = vi.fn();
let mockError: string | null = null;

vi.mock('../hooks/useProjects', () => ({
  useProjects: () => ({
    getProjectMetadata: mockGetProjectMetadata,
    getProject: async () => undefined,
    deleteProject: mockDeleteProject,
    saveProject: mockSaveProject,
    error: mockError,
    clearError: mockClearError,
    createProject: (name: string) => ({
      id: 'test-project-id',
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      objects: [],
      steps: [],
    }),
    isLoading: mockIsLoading,
    isSyncing: mockIsSyncing,
  }),
}));

// Simple mock pages for navigation testing (avoid EditorPage complexity)
function MockEditorPage() {
  return <div data-testid="editor-page">Editor Page</div>;
}
function MockEditorPageWithId() {
  return <div data-testid="editor-page-with-id">Editor Page With ID</div>;
}

// Helper to render with router for navigation testing
function renderHomePage(options?: { initialEntries?: string[] }) {
  const result = render(
    <MemoryRouter initialEntries={options?.initialEntries ?? ['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor" element={<MockEditorPage />} />
        <Route path="/editor/:id" element={<MockEditorPageWithId />} />
      </Routes>
    </MemoryRouter>
  );

  return result;
}

// Sample project data
const sampleProjects: ProjectMetadata[] = [
  {
    id: 'project-1',
    name: 'Test Project 1',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T11:00:00.000Z',
  },
  {
    id: 'project-2',
    name: 'Test Project 2',
    createdAt: '2024-01-14T10:00:00.000Z',
    updatedAt: '2024-01-14T12:00:00.000Z',
  },
  {
    id: 'project-3',
    name: 'Another Simulation',
    createdAt: '2024-01-13T10:00:00.000Z',
    updatedAt: '2024-01-13T15:00:00.000Z',
  },
];

// Sample projects with thumbnails
const sampleProjectsWithThumbnails: ProjectMetadata[] = [
  {
    id: 'project-with-thumbnail',
    name: 'Project With Thumbnail',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T11:00:00.000Z',
    thumbnail: 'data:image/jpeg;base64,mockThumbnailData123',
  },
  {
    id: 'project-with-cloud-thumb',
    name: 'Project With Cloud Thumb',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T11:00:00.000Z',
    thumbnail: 'thumb://test-user-id/project-with-cloud-thumb.jpg',
  },
  {
    id: 'project-without-thumbnail',
    name: 'Project Without Thumbnail',
    createdAt: '2024-01-14T10:00:00.000Z',
    updatedAt: '2024-01-14T12:00:00.000Z',
    // No thumbnail - should show placeholder
  },
];

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProjectMetadata.mockReturnValue([]);
    mockIsLoading = false;
    mockIsSyncing = false;
    mockError = null;
    mockResolveThumbnailUrl.mockResolvedValue(undefined);
  });

  describe('branding', () => {
    it('renders the Facilitate Studio branding', () => {
      renderHomePage();

      // Check for branding text - multiple h1 elements due to the overlay technique
      const headings = screen.getAllByRole('heading', { level: 1 });
      expect(headings.some((h) => h.textContent?.includes('Facilitate'))).toBe(true);
      expect(screen.getByText('Studio')).toBeInTheDocument();
    });

    it('renders the tagline', () => {
      renderHomePage();

      expect(
        screen.getByText(/create immersive training simulations for your team/i)
      ).toBeInTheDocument();
    });
  });

  describe('create new button', () => {
    it('renders the Create New Project button', () => {
      renderHomePage();

      const button = screen.getByRole('button', { name: /create new project/i });
      expect(button).toBeInTheDocument();
    });

    it('navigates to /editor when clicked', async () => {
      renderHomePage();
      const user = userEvent.setup();

      const button = screen.getByRole('button', { name: /create new project/i });
      await user.click(button);

      // Should navigate to editor page
      await waitFor(() => {
        expect(screen.getByTestId('editor-page')).toBeInTheDocument();
      });
    });
  });

  describe('recent section header', () => {
    it('renders the Recent section header', () => {
      renderHomePage();

      // Get h2 level heading specifically (the section header, not "No recent projects")
      expect(screen.getByRole('heading', { level: 2, name: /recent/i })).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when there are no projects', () => {
      mockGetProjectMetadata.mockReturnValue([]);
      renderHomePage();

      expect(screen.getByText('No recent projects')).toBeInTheDocument();
      expect(screen.getByText(/create your first simulation to get started/i)).toBeInTheDocument();
    });
  });

  describe('project cards', () => {
    beforeEach(() => {
      mockGetProjectMetadata.mockReturnValue(sampleProjects);
    });

    it('renders project cards when projects exist', () => {
      renderHomePage();

      expect(screen.getByText('Test Project 1')).toBeInTheDocument();
      expect(screen.getByText('Test Project 2')).toBeInTheDocument();
      expect(screen.getByText('Another Simulation')).toBeInTheDocument();
    });

    it('renders the correct number of project cards', () => {
      renderHomePage();

      // Project cards are h3 elements within the grid
      const projectHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(projectHeadings).toHaveLength(3);
    });

    it('navigates to project editor when a card is clicked', async () => {
      renderHomePage();
      const user = userEvent.setup();

      // Find the project heading and get its parent card
      const projectHeading = screen.getByText('Test Project 1');
      const projectCard = projectHeading.closest('[role="button"]') as HTMLElement;

      await user.click(projectCard);

      // Should navigate to editor page with ID
      expect(screen.getByTestId('editor-page-with-id')).toBeInTheDocument();
    });

    it('opens project when Enter key is pressed on a card', () => {
      renderHomePage();

      const projectHeading = screen.getByText('Test Project 1');
      const projectCard = projectHeading.closest('[role="button"]') as HTMLElement;

      fireEvent.keyDown(projectCard, { key: 'Enter' });

      expect(screen.getByTestId('editor-page-with-id')).toBeInTheDocument();
    });

    it('opens project when Space key is pressed on a card', () => {
      renderHomePage();

      const projectHeading = screen.getByText('Test Project 1');
      const projectCard = projectHeading.closest('[role="button"]') as HTMLElement;

      fireEvent.keyDown(projectCard, { key: ' ' });

      expect(screen.getByTestId('editor-page-with-id')).toBeInTheDocument();
    });

    it('calls deleteProject when delete button is clicked', async () => {
      renderHomePage();
      const user = userEvent.setup();

      // Find delete buttons
      const deleteButtons = screen.getAllByRole('button', { name: /delete project/i });
      expect(deleteButtons.length).toBeGreaterThan(0);

      await user.click(deleteButtons[0]);

      expect(mockDeleteProject).toHaveBeenCalledWith('project-1');
    });

    it('does not navigate when delete button is clicked', async () => {
      renderHomePage();
      const user = userEvent.setup();

      const deleteButtons = screen.getAllByRole('button', { name: /delete project/i });
      await user.click(deleteButtons[0]);

      // Should still be on homepage (not navigated)
      expect(mockDeleteProject).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('editor-page-with-id')).not.toBeInTheDocument();
    });

    it('displays timestamps for projects', () => {
      renderHomePage();

      // Should have time elements for each project (query by tag name since jsdom may not expose time role)
      const timeElements = document.querySelectorAll('time');
      expect(timeElements).toHaveLength(3);
      timeElements.forEach((el) => {
        expect(el).toHaveAttribute('dateTime');
      });
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      mockGetProjectMetadata.mockReturnValue(sampleProjects);
    });

    it('has proper heading hierarchy', () => {
      renderHomePage();

      // Main brand heading (h1) - may have multiple due to overlay technique
      const h1s = screen.getAllByRole('heading', { level: 1 });
      expect(h1s.length).toBeGreaterThan(0);

      // Section heading (h2)
      const h2 = screen.getByRole('heading', { level: 2 });
      expect(h2).toHaveTextContent(/recent/i);

      // Project name headings (h3)
      const h3s = screen.getAllByRole('heading', { level: 3 });
      expect(h3s.length).toBe(3);
    });

    it('project cards are keyboard focusable', () => {
      renderHomePage();

      const projectHeadings = screen.getAllByRole('heading', { level: 3 });
      projectHeadings.forEach((heading) => {
        const card = heading.closest('[role="button"]');
        expect(card).toHaveAttribute('tabIndex', '0');
      });
    });

    it('delete buttons have proper aria labels', () => {
      renderHomePage();

      const deleteButtons = screen.getAllByRole('button', { name: /delete project/i });
      deleteButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label');
      });
    });

    it('main content area uses semantic main element', () => {
      renderHomePage();

      const mainElement = screen.getByRole('main');
      expect(mainElement).toBeInTheDocument();
    });

    it('sections use semantic section elements', () => {
      renderHomePage();

      const sections = document.querySelectorAll('section');
      expect(sections.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('loading state', () => {
    it('shows loading indicator when isLoading is true', () => {
      mockIsLoading = true;
      mockGetProjectMetadata.mockReturnValue([]);
      renderHomePage();

      expect(screen.getByLabelText('Loading projects')).toBeInTheDocument();
      expect(screen.queryByText('No recent projects')).not.toBeInTheDocument();
    });

    it('shows projects after loading completes', () => {
      mockIsLoading = false;
      mockGetProjectMetadata.mockReturnValue(sampleProjects);
      renderHomePage();

      expect(screen.queryByLabelText('Loading projects')).not.toBeInTheDocument();
      expect(screen.getByText('Test Project 1')).toBeInTheDocument();
    });

    it('shows non-blocking syncing indicator when isSyncing is true', () => {
      mockIsLoading = false;
      mockIsSyncing = true;
      mockGetProjectMetadata.mockReturnValue(sampleProjects);
      renderHomePage();

      expect(screen.getByText('Syncing projects...')).toBeInTheDocument();
      expect(screen.getByText('Test Project 1')).toBeInTheDocument();
    });
  });

  describe('project thumbnails', () => {
    it('displays thumbnail image when project has a thumbnail', () => {
      mockGetProjectMetadata.mockReturnValue(sampleProjectsWithThumbnails);
      renderHomePage();

      // Find the thumbnail image by alt text
      const thumbnailImg = screen.getByAltText('Project With Thumbnail preview');
      expect(thumbnailImg).toBeInTheDocument();
      expect(thumbnailImg).toHaveAttribute('src', 'data:image/jpeg;base64,mockThumbnailData123');
    });

    it('displays placeholder icon when project has no thumbnail', () => {
      mockGetProjectMetadata.mockReturnValue(sampleProjectsWithThumbnails);
      renderHomePage();

      // The project without thumbnail should not have an img with preview alt text
      const placeholderProject = screen.getByText('Project Without Thumbnail');
      const projectCard = placeholderProject.closest('[role="button"]') as HTMLElement;

      // Should not have a thumbnail image (no preview alt text)
      expect(screen.queryByAltText('Project Without Thumbnail preview')).not.toBeInTheDocument();

      // The card should still exist
      expect(projectCard).toBeInTheDocument();
    });

    it('thumbnail image has object-cover styling for proper aspect ratio', () => {
      mockGetProjectMetadata.mockReturnValue(sampleProjectsWithThumbnails);
      renderHomePage();

      const thumbnailImg = screen.getByAltText('Project With Thumbnail preview');
      expect(thumbnailImg).toHaveClass('object-cover');
    });

    it('thumbnail container maintains 16:9 aspect ratio', () => {
      mockGetProjectMetadata.mockReturnValue(sampleProjectsWithThumbnails);
      renderHomePage();

      const thumbnailImg = screen.getByAltText('Project With Thumbnail preview');
      const container = thumbnailImg.closest('.aspect-video');
      expect(container).toBeInTheDocument();
    });

    it('renders correct alt text for accessibility', () => {
      mockGetProjectMetadata.mockReturnValue(sampleProjectsWithThumbnails);
      renderHomePage();

      const thumbnailImg = screen.getByAltText('Project With Thumbnail preview');
      expect(thumbnailImg).toHaveAttribute('alt', 'Project With Thumbnail preview');
    });

    it('handles mixed projects with and without thumbnails', () => {
      mockGetProjectMetadata.mockReturnValue(sampleProjectsWithThumbnails);
      renderHomePage();

      // Project with thumbnail should show the image
      expect(screen.getByAltText('Project With Thumbnail preview')).toBeInTheDocument();

      // Project without thumbnail should show in the list but without preview image
      expect(screen.getByText('Project Without Thumbnail')).toBeInTheDocument();
      expect(screen.queryByAltText('Project Without Thumbnail preview')).not.toBeInTheDocument();
    });

    it('applies hover scale effect to thumbnail image', () => {
      mockGetProjectMetadata.mockReturnValue(sampleProjectsWithThumbnails);
      renderHomePage();

      const thumbnailImg = screen.getByAltText('Project With Thumbnail preview');
      // Check for the transition and transform classes that enable hover effects
      expect(thumbnailImg).toHaveClass('transition-transform');
      expect(thumbnailImg).toHaveClass('group-hover:scale-105');
    });
  });

  describe('thumbnail rendering', () => {
    it('resolves thumb:// thumbnails to signed URLs for display', async () => {
      mockResolveThumbnailUrl.mockResolvedValue('https://example.com/signed.jpg');
      mockGetProjectMetadata.mockReturnValue(sampleProjectsWithThumbnails);

      renderHomePage();

      await waitFor(() => {
        const img = screen.getByAltText('Project With Cloud Thumb preview') as HTMLImageElement;
        expect(img).toBeInTheDocument();
        expect(img.src).toContain('https://example.com/signed.jpg');
      });
    });
  });
});
