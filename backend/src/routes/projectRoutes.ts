import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { projectService } from '../services/projectService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const projectRouter = Router();
projectRouter.use(requireAuth);

const createProjectSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(100),
  type: z.enum(['short', 'long']),
  scriptJson: z.any().optional(),
  metadataJson: z.any().optional(),
});

/**
 * POST /api/projects
 */
projectRouter.post('/', async (req: Request, res: Response) => {
  try {
    const validated = createProjectSchema.parse(req.body);
    const project = await projectService.createProject({
      userId: req.user!.id,
      title: validated.title,
      type: validated.type,
      scriptJson: validated.scriptJson,
      metadataJson: validated.metadataJson,
    });
    res.status(201).json({ project });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.errors[0]?.message } });
    }
    res.status(500).json({ error: { code: 'PROJECT_CREATE_ERROR', message: 'Failed to create project.' } });
  }
});

/**
 * GET /api/projects
 */
projectRouter.get('/', async (req: Request, res: Response) => {
  try {
    const projects = await projectService.getUserProjects(req.user!.id);
    res.json({ projects });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'PROJECTS_FETCH_ERROR', message: 'Failed to retrieve projects.' } });
  }
});

/**
 * GET /api/projects/:id
 */
projectRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await projectService.getProjectById(req.user!.id, projectId);

    if (!project) {
      return res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found.' } });
    }

    res.json({ project });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'PROJECT_FETCH_ERROR', message: 'Failed to fetch project.' } });
  }
});

/**
 * DELETE /api/projects/:id
 */
projectRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await projectService.deleteProject(req.user!.id, projectId);

    if (!deleted) {
      return res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found.' } });
    }

    res.json({ message: 'Project deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'PROJECT_DELETE_ERROR', message: 'Failed to delete project.' } });
  }
});
