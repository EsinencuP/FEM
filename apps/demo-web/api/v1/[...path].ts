import { proxyApiRequest } from '../../src/api/vercel-proxy';

export default {
  fetch(request: Request): Promise<Response> {
    return proxyApiRequest(request, process.env.FEM_BACKEND_ORIGIN);
  },
};
