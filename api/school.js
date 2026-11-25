import { accountApi } from '../server/accountApi.mjs';

const app = accountApi();
export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const route = url.searchParams.get('endpoint') || url.pathname.replace(/^\/api\/accounts\//, '');
  url.searchParams.delete('endpoint');
  req.url = '/' + route + '?' + url.searchParams;
  return app(req, res);
}
