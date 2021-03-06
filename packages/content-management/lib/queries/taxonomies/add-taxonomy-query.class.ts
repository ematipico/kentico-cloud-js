import { Observable } from 'rxjs';

import { IContentManagementClientConfig } from '../../config';
import { TaxonomyModels } from '../../models';
import { TaxonomyResponses } from '../../responses';
import { ContentManagementQueryService } from '../../services';
import { BaseQuery } from '../base-query';

export class AddTaxonomyQuery extends BaseQuery<TaxonomyResponses.AddTaxonomyResponse> {

  constructor(
    protected config: IContentManagementClientConfig,
    protected queryService: ContentManagementQueryService,
    protected data: TaxonomyModels.IAddTaxonomyRequestModel
  ) {
    super(config, queryService);
  }

  toObservable(): Observable<TaxonomyResponses.AddTaxonomyResponse> {
    return this.queryService.addTaxonomy(this.getUrl(), this.data, this.queryConfig);
  }

  protected getAction(): string {
    return this.actions.contentItemActions.listTaxonomies();
  }
}
