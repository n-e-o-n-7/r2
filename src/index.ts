/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	r2: R2Bucket;
}

function objectNotFound(objectName: string): Response {
	return new Response(`<html><body>R2 object "<b>${objectName}</b>" not found</body></html>`, {
		status: 404,
		headers: {
			'content-type': 'text/html; charset=UTF-8',
		},
	});
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const objectName = url.pathname.slice(1);

		console.log(`${request.method} object ${objectName}: ${request.url}`);

		if (request.method === 'GET' || request.method === 'HEAD') {
			if (objectName === '') {
				if (request.method === 'HEAD') {
					return new Response(undefined, { status: 400 });
				}

				const options: R2ListOptions = {
					prefix: url.searchParams.get('prefix') ?? undefined,
					delimiter: url.searchParams.get('delimiter') ?? undefined,
					cursor: url.searchParams.get('cursor') ?? undefined,
					// include: ['customMetadata', 'httpMetadata'],
				};
				console.log(JSON.stringify(options));

				const listing = await env.r2.list(options);
				return new Response(JSON.stringify(listing), {
					headers: {
						'content-type': 'application/json; charset=UTF-8',
					},
				});
			}

			if (request.method === 'GET') {
				// const object = await env.r2.get(objectName, {
				// 	range: request.headers,
				// 	onlyIf: request.headers,
				// });
				const object = await env.r2.get(objectName);

				if (object === null) {
					return objectNotFound(objectName);
				}

				const headers = new Headers();
				object.writeHttpMetadata(headers);
				headers.set('etag', object.httpEtag);
				// if (object.range) {
				// 	headers.set('content-range', `bytes ${object.range.offset}-${object.range.end ?? object.size - 1}/${object.size}`);
				// }
				const status = object.body ? (request.headers.get('range') !== null ? 206 : 200) : 304;
				return new Response(object.body, {
					headers,
					status,
				});
			}

			const object = await env.r2.head(objectName);

			if (object === null) {
				return objectNotFound(objectName);
			}

			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set('etag', object.httpEtag);
			return new Response(null, {
				headers,
			});
		}
		if (request.method === 'PUT' || request.method === 'POST') {
			const object = await env.r2.put(objectName, request.body, {
				httpMetadata: request.headers,
			});
			return new Response(null, {
				headers: {
					etag: object.httpEtag,
				},
			});
		}
		if (request.method === 'DELETE') {
			await env.r2.delete(url.pathname.slice(1));
			return new Response();
		}

		return new Response(`Unsupported method`, {
			status: 400,
		});
	},
};
