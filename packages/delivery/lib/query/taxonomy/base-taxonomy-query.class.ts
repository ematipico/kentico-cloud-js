import { IHeader } from 'kentico-cloud-core';
import { Observable } from 'rxjs';

import { IDeliveryClientConfig } from '../../config';
import { ICloudResponse, ITaxonomyQueryConfig } from '../../interfaces';
import { TaxonomyResponses } from '../../models/';
import { QueryService } from '../../services';
import { BaseQuery } from '../common/base-query.class';

export abstract class BaseTaxonomyQuery<TResponse extends ICloudResponse> extends BaseQuery<TResponse> {

    /**
     * Taxonomies endpoint URL action
     */
    protected readonly taxonomiesEndpoint: string = 'taxonomies';

    /**
     * Query configuration
     */
    protected _queryConfig: ITaxonomyQueryConfig = {};

    constructor(
        protected config: IDeliveryClientConfig,
        protected queryService: QueryService
    ) {
        super(config, queryService);
    }

    /**
     * Used to configure query
     * @param queryConfig Query configuration
     */
    queryConfig(queryConfig: ITaxonomyQueryConfig): this {
        this._queryConfig = queryConfig;
        return this;
    }

    /**
     * Gets headers used by this query
     */
    getHeaders(): IHeader[] {
        return this.queryService.getHeaders(this._queryConfig);
    }

    protected getTaxonomyQueryUrl(taxonomyCodename: string): string {
        const action = '/' + this.taxonomiesEndpoint + '/' + taxonomyCodename;

        return super.resolveUrlInternal(action);
    }

    protected getTaxonomiesQueryUrl(): string {
        const action = '/' + this.taxonomiesEndpoint;

        return super.resolveUrlInternal(action);
    }

    protected runTaxonomyQuery(codename: string): Observable<TaxonomyResponses.TaxonomyResponse> {
        return this.queryService.getTaxonomy(this.getTaxonomyQueryUrl(codename), this._queryConfig);
    }

    protected runTaxonomiesQuery(): Observable<TaxonomyResponses.TaxonomiesResponse> {
        return this.queryService.getTaxonomies(this.getTaxonomiesQueryUrl(), this._queryConfig);
    }
}
