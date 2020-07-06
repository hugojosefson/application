import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ParsedUrl from 'url-parse';
import { stringify } from '@elements/json';
import { Application } from './application';
import { Browser } from './browser';
import { Session } from './session';
import { debug } from './debug';
import { Logger } from './logger';
import {
  IHeaderMap,
  HeaderValue,
  IRequest,
  IMetaTag,
  IGoOpts,
} from './types';

export interface IBrowserRequestOpts {
  app: Application;
  browser: Browser;
  url: string;
  session: Session;
  logger: Logger;
}

export class BrowserRequest implements IRequest {
  public session: Session;
  public url: string
  public params: Map<any, any>;
  public parsedUrl: ParsedUrl;
  private _app: Application;
  private _browser: Browser;
  private _meta: {[index: string]: IMetaTag};
  private _title: string;
  private _description: string;
  private _logger: Logger;

  public get method(): string {
    return 'GET';
  }

  public get query(): {[key: string]: any} {
    return this.parsedUrl.query;
  }

  public get hash(): string {
    return this.parsedUrl.hash;
  }

  public constructor(opts: IBrowserRequestOpts) {
    this.session = opts.session;
    this.url = opts.url;
    this.parsedUrl = ParsedUrl(opts.url, true /* parse query string */);
    this._app = opts.app;
    this._logger = opts.logger;
    this._browser = opts.browser;
    this._meta = {};
    this._title = '';
    this._description = '';
  }

  public title(value?: string): string {
    if (arguments.length == 1) {
      this._title = value;
    }

    if (this._title && this._title.length > 0) {
      return this._title;
    } else {
      return this._app.title();
    }
  }

  public description(value?: string): string {
    if (arguments.length == 1) {
      this._description = value;
    }

    if (this._description && this._description.length > 0) {
      return this._description;
    } else {
      return this._app.description();
    }
  }

  public meta(value: IMetaTag): this {
    if (value.name) {
      this._meta[value.name] = value;
    } else if (value.httpEquiv) {
      this._meta[value.httpEquiv] = value;
    } else {
      throw new Error('The meta object must have either a name or httpEquiv property.');
    }

    return this;
  }

  public getMeta(): {[index: string]: IMetaTag} {
    return Object.assign({}, this._app.getMeta(), this._meta);
  }

  /**
   * Navigate to the given url using browser push state.
   *
   * @param url - The url or path to go to.
   * @param [options]
   * @param [options.replace] - If this is true then we'll use
   * replaceState instead of pushState to update the browser url. It's useful in
   * cases where you don't want the new url to be part of the browser history so
   * that when the user clicks the back button they won't come back to this url.
   * Most of the time this should be left as false which is the default.
   */
  public go(url: string, options: IGoOpts = {}): void {
    this._browser.go(url, options);
  }

  /**
   * Makes a remote procedure call over the network to the given service
   * function.
   *
   * @param method - The namespace delimited method name (e.g.
   * users.getUserData).
   * @param [args] - Positional arguments passed to the service function.
   */
  public call<T = any>(method: string, ...args: any[]): Promise<T> {
    return this._browser.call(method, ...args);
  }

  /**
   * Renders a view to the page.
   *
   * @param vpath - The virtual path (e.g. project://app/pages/home/index.tsx)
   * to the page and its bundle.
   * @param [attrs] - Initial data attributes for the view.
   */
  public async render<T = any>(vpath: string, attrs?: T): Promise<void> {
    debug('render %s', vpath);

    try {
      await window['loader'].load(vpath, async (): Promise<void> => {
        this.setTitle();
        this.setMeta();
        let prevVPath = this._browser.getCurrentVPath();
        this._browser.setCurrentVPath(vpath);

        let view = require(vpath).default;
        if (!view) {
          throw new Error(`Unable to render view because a default view class was not exported from the file ${vpath}.`);
        }

        if (vpath != prevVPath) {
          ReactDOM.unmountComponentAtNode(document.body.children[0]);
        }
        let el = React.createElement(view, attrs);
        ReactDOM.render(el, document.body.children[0]);
      });
    } catch (err) {
      this._browser.renderUnhandledErrorPage(err);
    }
  }

  public status(value?: number): number {
    return 200;
  }

  public header(key: string | IHeaderMap, value?: HeaderValue): HeaderValue {
    return undefined;
  }

  public write(content: string): boolean {
    console.log(content);
    return true;
  }

  public json(value: any): boolean {
    console.log(stringify(value));
    return true;
  }

  public end(): void {
  }

  // change to writeTitle or createTitleElement
  private setTitle() {
    let title = this.title();
    document.querySelectorAll('head title').forEach(el => el.remove());
    let el = document.createElement('title');
    el.text = title;
    document.head.prepend(el);
  }

  private setMeta() {
    document.querySelectorAll('head meta').forEach(el => {
      if (el.hasAttribute('data-keep') === false) {
        el.remove();
      }
    });

    let fragment = document.createDocumentFragment();
    let defaultMetaTags: IMetaTag[] = [
      { name: 'description', content: this.description() },
    ];

    defaultMetaTags.concat(Object.values(this.getMeta())).forEach(meta => {
      let key = meta.httpEquiv ? 'http-equiv' : 'name';
      let keyValue = meta.httpEquiv || meta.name;
      let el = document.createElement('meta');
      el[key] = keyValue;
      el.content = meta.content;
      fragment.appendChild(el);
    });

    let linkOrScriptElements = document.querySelectorAll('head link, head script');
    if (linkOrScriptElements.length > 0) {
      document.head.insertBefore(fragment, linkOrScriptElements[0]);
    } else {
      document.head.appendChild(fragment);
    }
  }

  public log(msg: string, ...args: any[]): void {
    this._logger.log(msg, ...args);
  }
}
