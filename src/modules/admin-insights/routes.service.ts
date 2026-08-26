import { Injectable } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { resolveRouteGroup } from './route-groups';

export interface AdminRouteEntry {
  method: string;
  path: string;
  controllerName: string;
  handlerName: string;
  group: string;
  groupLabel: string;
}

@Injectable()
export class RoutesService {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  listRoutes(): AdminRouteEntry[] {
    const routes: AdminRouteEntry[] = [];
    const controllers = this.discovery.getControllers();

    for (const wrapper of controllers) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) {
        continue;
      }

      const controllerPath = this.normalizeSegment(
        Reflect.getMetadata(PATH_METADATA, metatype) as string | undefined,
      );
      const prototype = Object.getPrototypeOf(instance) as object;

      this.metadataScanner.scanFromPrototype(
        instance,
        prototype,
        (methodName: string) => {
          const handler = prototype[methodName as keyof typeof prototype] as
            | object
            | undefined;
          if (!handler) {
            return;
          }

          const routePathRaw = Reflect.getMetadata(PATH_METADATA, handler) as
            | string
            | string[]
            | undefined;
          if (routePathRaw === undefined) {
            return;
          }

          const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
            | RequestMethod
            | undefined;
          if (requestMethod === undefined) {
            return;
          }

          const methodName_ = RequestMethod[requestMethod];
          const method =
            typeof methodName_ === 'string' ? methodName_.toUpperCase() : 'GET';

          const routePaths = Array.isArray(routePathRaw)
            ? routePathRaw
            : [routePathRaw];

          for (const routePath of routePaths) {
            const path = this.composePath(controllerPath, routePath);
            const { group, groupLabel } = resolveRouteGroup(path, metatype.name);
            routes.push({
              method,
              path,
              controllerName: metatype.name,
              handlerName: methodName,
              group,
              groupLabel,
            });
          }
        },
      );
    }

    return routes.sort((a, b) => {
      const pathCompare = a.path.localeCompare(b.path);
      if (pathCompare !== 0) {
        return pathCompare;
      }
      return a.method.localeCompare(b.method);
    });
  }

  private normalizeSegment(segment: string | string[] | undefined): string {
    if (!segment) {
      return '';
    }
    const value = Array.isArray(segment) ? segment[0] : segment;
    if (typeof value !== 'string') {
      return '';
    }
    return value.replace(/^\/+|\/+$/g, '');
  }

  private composePath(controllerPath: string, routePath: string | string[]): string {
    const handlerSegment = this.normalizeSegment(routePath);
    const parts = [controllerPath, handlerSegment].filter(Boolean);
    return `/${parts.join('/')}`;
  }
}
