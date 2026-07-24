import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

const REVALIDATED_PUBLIC_CACHE = 'public, max-age=0, s-maxage=0, must-revalidate';

@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const lang = request.params.lang;

    response.setHeader('Cache-Control', REVALIDATED_PUBLIC_CACHE);
    if (typeof lang === 'string') response.setHeader('Content-Language', lang);
    response.vary('Origin');
    response.vary('Accept-Encoding');

    return next.handle();
  }
}
