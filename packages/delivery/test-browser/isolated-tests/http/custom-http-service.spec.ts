import {
    IBaseResponse,
    IHttpDeleteQueryCall,
    IHttpGetQueryCall,
    IHttpPostQueryCall,
    IHttpPutQueryCall,
    IHttpQueryOptions,
    IHttpService,
} from 'kentico-cloud-core';
import { Observable, of } from 'rxjs';

import { DeliveryClient } from '../../../lib';

class CustomHttpService implements IHttpService {
    get<TError extends any, TRawData extends any>(
        call: IHttpGetQueryCall<TError>,
        options?: IHttpQueryOptions
    ): Observable<IBaseResponse<TRawData>> {
        return of(<IBaseResponse<TRawData>>{
            data: {},
            response: undefined
        });
    }

    post<TError extends any, TRawData extends any>(
        call: IHttpPostQueryCall<TError>,
        options?: IHttpQueryOptions
    ): Observable<IBaseResponse<TRawData>> {
        return of(<IBaseResponse<TRawData>>{
            data: {},
            response: undefined
        });
    }

    put<TError extends any, TRawData extends any>(
        call: IHttpPutQueryCall<TError>,
        options?: IHttpQueryOptions
    ): Observable<IBaseResponse<TRawData>> {
        return of(<IBaseResponse<TRawData>>{
            data: {},
            response: undefined
        });
    }

    delete<TError extends any, TRawData extends any>(
        call: IHttpDeleteQueryCall<TError>,
        options?: IHttpQueryOptions
    ): Observable<IBaseResponse<TRawData>> {
        return of(<IBaseResponse<TRawData>>{
            data: {},
            response: undefined
        });
    }
}

describe('Custom Http service', () => {
    const client = new DeliveryClient({
        projectId: 'xxx',
        httpService: new CustomHttpService()
    });

    it(`Should use custom http service`, () => {
        // this is fragile, but we don't want to expose these properties for now
        const httpService = client['queryService']['httpService'];
        expect(httpService).toEqual(jasmine.any(CustomHttpService));
    });
});
