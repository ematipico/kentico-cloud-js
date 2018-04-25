import { Observable } from 'rxjs';

import { IDeliveryClientConfig } from '../../config';
import { ICloudResponse, IQueryParameter } from '../../interfaces';
import { QueryService } from '../../services';

export abstract class BaseQuery<TResponse extends ICloudResponse> {

    protected parameters: IQueryParameter[] = [];

    constructor(
        protected config: IDeliveryClientConfig,
        protected queryService: QueryService
    ) {
    }

    abstract getUrl(): string;
    abstract getObservable(): Observable<TResponse>;

    getParameters(): IQueryParameter[] {
        return this.parameters;
    }

    getPromise(): Promise<TResponse> {
        return this.getObservable().toPromise();
    }
}
