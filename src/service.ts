import { Logger } from './logger';
import {
  ISessionHost
} from './types';

import {
  NotAuthorizedError
} from './errors';
import { Session } from './session';

export type AuthorizeCallback = (this: Service, session: Session) => boolean;

export interface IServiceOpts {
  session: Session;
  logger: Logger;
}

export class Service {
  public session: Session;

  public logger: Logger;

  public constructor(opts: IServiceOpts) {
    this.session = opts.session;
    this.logger = opts.logger;
  }

  public async authorize(callback: AuthorizeCallback | boolean): Promise<void> {
    let isAuthorized: boolean = false;

    if (typeof callback === 'boolean') {
      isAuthorized = callback;
    } else {
      isAuthorized = await callback.call(this, this.session);
    }

    if (!isAuthorized) {
      throw new NotAuthorizedError();
    }
  }

  public static create(opts: IServiceOpts): Service {
    return new Service(opts);
  }
}
