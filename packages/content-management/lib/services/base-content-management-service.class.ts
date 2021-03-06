import {
    CloudError,
    headerHelper,
    IBaseResponse,
    IBaseResponseError,
    IHeader,
    IHttpService,
    IQueryParameter,
    ISDKInfo,
    mapCloudError,
    urlHelper,
} from 'kentico-cloud-core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { IContentManagementClientConfig } from '../config/icontent-management-client-config.interface';
import { IContentManagementQueryConfig } from '../models';

export abstract class BaseContentManagementQueryService {

    /**
     * Default base url for content management API
     */
    private readonly defaultBaseCMUrl: string = 'https://manage.kenticocloud.com/v2/projects';

    /**
     * Default number of retry attempts when user did not set any
     */
    private readonly defaultRetryAttempts: number = 3;

    /**
     * Allowed retry status codes
     */
    private readonly useRetryForResponseCodes: number[] = [500];

    constructor(
        protected config: IContentManagementClientConfig,
        protected httpService: IHttpService,
        protected sdkInfo: ISDKInfo
    ) { }

    /**
     * Gets url based on the action, query configuration and options (parameters)
     * @param action Action (= url part) that will be hit
     * @param options Query options
     */
    getFullUrl(action: string, options?: IQueryParameter[]): string {
        return urlHelper.addOptionsToUrl(this.getBaseUrl() + '/' + action, options);
    }

    /**
     * Gets proper set of headers for given request.
     */
    getHeaders(extraHeaders?: IHeader[]): IHeader[] {
        let headers: IHeader[] = [
            // sdk tracking header
            headerHelper.getSdkIdHeader({
                host: this.sdkInfo.host,
                name: this.sdkInfo.name,
                version: this.sdkInfo.version
            }),
            // add authorization header
            this.getAuthorizationHeader(this.config.apiKey)
        ];

        if (extraHeaders) {
            headers = headers.concat(extraHeaders);
        }

        return headers;
    }

    /**
     * Http GET response
     * @param url Url of request
     * @param config Query configuration
     */
    protected getResponse<TRawData>(
        url: string,
        config?: IContentManagementQueryConfig
    ): Observable<IBaseResponse<TRawData>> {
        if (!config) {
            config = {};
        }

        return this.httpService.get<CloudError | any, TRawData>(
            {
                url: url,
                mapError: error => mapCloudError(error)
            },
            {
                headers: this.getHeaders(),
                maxRetryAttempts: this.getRetryAttempts(),
                useRetryForResponseCodes: this.useRetryForResponseCodes,
                logErrorToConsole: true
            }
        ).pipe(
            catchError((error: IBaseResponseError<CloudError>) => {
                return throwError(error.mappedError);
            })
        );
    }

    /**
     * Http POST response
     * @param url Url of request
     * @param body Body of the request (names and values)
     * @param config Query configuration
     * @param extraHeaders Extra headers
     */
    protected postResponse<TRawData>(
        url: string,
        body: any,
        config: IContentManagementQueryConfig,
        extraHeaders?: IHeader[]
    ): Observable<IBaseResponse<TRawData>> {
        if (!config) {
            config = {};
        }

        return this.httpService.post<CloudError | any, TRawData>(
            {
                url: url,
                body: body,
                mapError: error => mapCloudError(error)
            },
            {
                headers: this.getHeaders(extraHeaders),
                maxRetryAttempts: this.getRetryAttempts(),
                useRetryForResponseCodes: this.useRetryForResponseCodes,
                logErrorToConsole: true
            }
        ).pipe(
            catchError((error: IBaseResponseError<CloudError>) => {
                return throwError(error.mappedError);
            })
        );
    }

    /**
    * Http PUT response
    * @param url Url of request
    * @param body Body of the request (names and values)
    * @param config Query configuration
    * @param extraHeaders Extra headers
    */
    protected putResponse<TRawData>(
        url: string,
        body: any,
        config: IContentManagementQueryConfig,
        extraHeaders?: IHeader[]
    ): Observable<IBaseResponse<TRawData>> {
        if (!config) {
            config = {};
        }

        return this.httpService.put<CloudError | any, TRawData>(
            {
                url: url,
                body: body,
                mapError: error => mapCloudError(error)
            },
            {
                headers: this.getHeaders(extraHeaders),
                maxRetryAttempts: this.getRetryAttempts(),
                useRetryForResponseCodes: this.useRetryForResponseCodes,
                logErrorToConsole: true
            }
        ).pipe(
            catchError((error: IBaseResponseError<CloudError>) => {
                return throwError(error.mappedError);
            })
        );
    }

    /**
    * Http Delete response
    * @param url Url of request
    * @param body Body of the request (names and values)
    * @param config Query configuration
    * @param extraHeaders Extra headers
    */
    protected deleteResponse<TRawData>(
        url: string,
        config: IContentManagementQueryConfig,
        extraHeaders?: IHeader[]
    ): Observable<IBaseResponse<TRawData>> {
        if (!config) {
            config = {};
        }

        return this.httpService.delete<CloudError | any, TRawData>(
            {
                url: url,
                mapError: error => mapCloudError(error)
            },
            {
                headers: this.getHeaders(extraHeaders),
                maxRetryAttempts: this.getRetryAttempts(),
                useRetryForResponseCodes: this.useRetryForResponseCodes,
                logErrorToConsole: true
            }
        ).pipe(
            catchError((error: IBaseResponseError<CloudError>) => {
                return throwError(error.mappedError);
            })
        );
    }

    /**
    * Gets authorization header. This is used for 'preview' functionality
    */
    private getAuthorizationHeader(key?: string): IHeader {
        if (!key) {
            throw Error(`Cannot get authorization header because key is undefined`);
        }
        // authorization header required for preview mode
        return {
            header: 'authorization',
            value: `bearer ${key}`
        };
    }

    /**
     * Gets number of retry attempts used by queries
     */
    private getRetryAttempts(): number {
        // get the attempts
        let attempts: number;

        if (this.config.retryAttempts || this.config.retryAttempts === 0) {
            // use custom defined number of attempts
            attempts = this.config.retryAttempts;
        } else {
            // use default attempts
            attempts = this.defaultRetryAttempts;
        }

        return attempts;
    }

    /**
     * Gets base URL of the request including the project Id
     */
    private getBaseUrl(): string {
        return this.GetEndpointUrl() + '/' + this.config.projectId;
    }

    /**
     * Gets API endpoint url
     */
    private GetEndpointUrl(): string {
        if (this.config.baseUrl) {
            return this.config.baseUrl;
        }
        return this.defaultBaseCMUrl;
    }
}
