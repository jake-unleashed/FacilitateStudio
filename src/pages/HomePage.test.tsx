import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './HomePage';
import { ProjectMetadata } from '../types/project';

// Mock useProjects hook
const mockDeleteProject = vi.fn();
const mockGetProjectMetadata = vi.fn<[], ProjectMetadata[]>();
const mockSaveProject = vi.fn();
let mockIsLoading = false;

vi.mock('../hooks/useProjects', () => ({
  useProjects: () => ({
    getProjectMetadata: mockGetProjectMetadata,
    getProject: () => undefined,
    deleteProject: mockDeleteProject,
    saveProject: mockSaveProject,
    createProject: (name: string) => ({
      id: 'test-project-id',
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      objects: [],
      steps: [],
    }),
    isLoading: mockIsLoading,
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

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProjectMetadata.mockReturnValue([]);
    mockIsLoading = false;
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
    it('renders the Create New Simulation button', () => {
      renderHomePage();

      const button = screen.getByRole('button', { name: /create new simulation/i });
      expect(button).toBeInTheDocument();
    });

    it('navigates to /editor when clicked', async () => {
      renderHomePage();
      const user = userEvent.setup();

      const button = screen.getByRole('button', { name: /create new simulation/i });
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
      expect(
        screen.getByText(/create your first simulation to get started/i)
      ).toBeInTheDocument();
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

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByText('No recent projects')).not.toBeInTheDocument();
    });

    it('shows projects after loading completes', () => {
      mockIsLoading = false;
      mockGetProjectMetadata.mockReturnValue(sampleProjects);
      renderHomePage();

      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      expect(screen.getByText('Test Project 1')).toBeInTheDocument();
    });
  });
});
