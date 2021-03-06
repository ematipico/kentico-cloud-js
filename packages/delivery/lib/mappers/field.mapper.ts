import { IDeliveryClientConfig } from '../config';
import { ItemContracts } from '../data-contracts';
import { FieldContracts, FieldDecorators, FieldModels, Fields, FieldType } from '../fields';
import { IItemQueryConfig, ILinkResolverContext, ILinkResolverResult } from '../interfaces';
import { ContentItem, Link } from '../models';
import { IRichTextHtmlParser } from '../parser/parse-models';
import { richTextResolver, stronglyTypedResolver, urlSlugResolver } from '../resolvers';

export class FieldMapper {

    private readonly defaultLinkedItemWrapperTag: string = 'p';
    private readonly defaultLinkedItemWrapperClasses: string[] = ['kc-linked-item-wrapper'];

    constructor(
        private readonly config: IDeliveryClientConfig,
        private readonly richTextHtmlParser: IRichTextHtmlParser
    ) {
    }

    /**
     * Maps all fields in given content item and returns strongly typed content item based on the resolver specified
     * in DeliveryClientConfig
     * @param item Item to map (raw response from Kentico Cloud)
     * @param modularContent Modular content sent along with item
     * @param queryConfig Query configuration
     */
    mapFields<TItem extends ContentItem>(item: ItemContracts.IContentItemContract, modularContent: any, queryConfig: IItemQueryConfig, processedItems: ContentItem[]): TItem {
        if (!item) {
            throw Error(`Cannot map fields because item is not defined`);
        }

        if (!item.system) {
            throw Error(`Cannot map item because it does not contain system attributes. This is an essential field and every item should have one.`);
        }

        if (!item.elements) {
            throw Error(`Cannot map elements of item with codename '${item.system.codename}'`);
        }

        if (!processedItems) {
            throw Error(`ProcessedItems need to be initialized`);
        }

        if (!Array.isArray(processedItems)) {
            throw Error(`ProcessedItems need to be an array`);
        }

        const properties = Object.getOwnPropertyNames(item.elements);

        let itemTyped: TItem;

        // check if resolver for this type is available
        if (this.config.typeResolvers && stronglyTypedResolver.hasTypeResolver(item.system.type, this.config.typeResolvers)) {
            itemTyped = stronglyTypedResolver.createTypedObj(item.system.type, item, this.config.typeResolvers) as TItem;
        } else {
            itemTyped = stronglyTypedResolver.createContentItem(item) as TItem;
        }

        // add/taken item to processed items to avoid infinite recursion
        const processedItem = processedItems.find(m => m.system.codename === item.system.codename);
        if (!processedItem) {
            processedItems.push(itemTyped);
        }

        properties.forEach(fieldName => {
            const field = item.elements[fieldName] as FieldContracts.IFieldContract;
            let propertyName: string | undefined;

            // resolve field to a custom model property
            if (itemTyped.propertyResolver) {
                propertyName = itemTyped.propertyResolver(fieldName);
            }

            // if property hasn't been resolved, try with decorator
            if (!propertyName) {
                propertyName = FieldDecorators.getPropertyName(itemTyped, fieldName);
            }

            // if property name is null/empty, use elements codename
            if (!propertyName) {
                propertyName = fieldName;
            }
            itemTyped[propertyName] = this.mapField(field, modularContent, itemTyped, queryConfig, processedItems);
        });

        return itemTyped;
    }

    private mapField(field: FieldContracts.IFieldContract, modularContent: any, item: ContentItem, queryConfig: IItemQueryConfig, processedItems: ContentItem[]): FieldModels.IField | ContentItem[] {
        const fieldType = field.type.toLowerCase();

        if (fieldType.toLowerCase() === FieldType.ModularContent.toLowerCase()) {
            return this.mapLinkedItemsField(field, modularContent, queryConfig, processedItems);
        }

        if (fieldType.toLowerCase() === FieldType.Text.toLowerCase()) {
            return this.mapTextField(field);
        }
        if (fieldType.toLowerCase() === FieldType.Asset.toLowerCase()) {
            return this.mapAssetsField(field);
        }

        if (fieldType.toLowerCase() === FieldType.Number.toLowerCase()) {
            return this.mapNumberField(field);
        }
        if (fieldType.toLowerCase() === FieldType.MultipleChoice.toLowerCase()) {
            return this.mapMultipleChoiceField(field);
        }

        if (fieldType.toLowerCase() === FieldType.DateTime.toLowerCase()) {
            return this.mapDateTimeField(field);
        }

        if (fieldType.toLowerCase() === FieldType.RichText.toLowerCase()) {
            return this.mapRichTextField(field as FieldContracts.IRichTextFieldContract, modularContent, queryConfig, processedItems);
        }

        if (fieldType.toLowerCase() === FieldType.UrlSlug.toLowerCase()) {
            return this.mapUrlSlugField(field, item, queryConfig);
        }

        if (fieldType.toLowerCase() === FieldType.Taxonomy.toLowerCase()) {
            return this.mapTaxonomyField(field);
        }

        if (fieldType.toLowerCase() === FieldType.Custom.toLowerCase()) {
            return this.mapCustomField(field, item.system.type);
        }

        const error = `Unsupported field type '${field.type}'`;

        throw Error(error);
    }

    private mapRichTextField(field: FieldContracts.IRichTextFieldContract, modularContent: any, queryConfig: IItemQueryConfig, processedItems: ContentItem[]): Fields.RichTextField {
        // get all linked items nested in rich text
        const linkedItems: ContentItem[] = [];

        if (field.modular_content) {
            if (Array.isArray(field.modular_content)) {
                field.modular_content.forEach(codename => {
                    // get linked item and check if it exists (it might not be included in response due to 'Depth' parameter)
                    const rawItem = modularContent[codename] as ItemContracts.IContentItemContract | undefined;

                    // first try to get existing item
                    const existingLinkedItem = this.getOrSaveLinkedItem(codename, field, queryConfig, modularContent, processedItems);

                    if (existingLinkedItem) {
                        // item was found, add it to linked items
                        linkedItems.push(existingLinkedItem);
                    } else {
                        let throwErrorForMissingLinkedItems = false;

                        // check if errors should be thrown for missing linked items
                        if (queryConfig.throwErrorForMissingLinkedItems === false || queryConfig.throwErrorForMissingLinkedItems === true) {
                            // variable is a boolean
                            throwErrorForMissingLinkedItems = queryConfig.throwErrorForMissingLinkedItems;
                        }

                        // throw error if raw item is not available and errors are not skipped
                        if (!rawItem) {
                            const msg = `Mapping RichTextField field '${field.name}' failed because referenced linked item with codename '${codename}' could not be found in Delivery response.
                            Increasing 'depth' parameter may solve this issue as it will include nested items. Alternatively you may disable 'throwErrorForMissingLinkedItems' in your query`;

                            if (throwErrorForMissingLinkedItems) {
                                throw Error(msg);
                            }
                        }

                        // item was not found or not yet resolved
                        if (rawItem) {
                            const mappedLinkedItem = this.mapFields(rawItem, modularContent, queryConfig, processedItems);

                            // add mapped linked item to result
                            if (mappedLinkedItem) {
                                linkedItems.push(mappedLinkedItem);
                            }
                        }
                    }
                });
            }
        }

        // extract and map links
        const links: Link[] = this.mapRichTextLinks(field.links);

        return new Fields.RichTextField(
            field.name,
            field.value,
            field.modular_content,
            {
                links: links,
                resolveHtml: () => richTextResolver.resolveHtml(field.value, {
                    enableAdvancedLogging: this.config.enableAdvancedLogging ? this.config.enableAdvancedLogging : false,
                    typeResolvers: this.config.typeResolvers ? this.config.typeResolvers : [],
                    richTextHtmlParser: this.richTextHtmlParser,
                    getLinkedItem: (codename) => this.getOrSaveLinkedItem(codename, field, queryConfig, modularContent, linkedItems),
                    links: links,
                    queryConfig: queryConfig,
                    linkedItemWrapperTag: this.config.linkedItemResolver && this.config.linkedItemResolver.linkedItemWrapperTag
                        ? this.config.linkedItemResolver.linkedItemWrapperTag
                        : this.defaultLinkedItemWrapperTag,
                    linkedItemWrapperClasses: this.config.linkedItemResolver && this.config.linkedItemResolver.linkedItemWrapperClasses
                        ? this.config.linkedItemResolver.linkedItemWrapperClasses
                        : this.defaultLinkedItemWrapperClasses
                })
            });
    }

    private mapDateTimeField(field: FieldContracts.IFieldContract): Fields.DateTimeField {
        return new Fields.DateTimeField(field.name, field.value);
    }

    private mapMultipleChoiceField(field: FieldContracts.IFieldContract): Fields.MultipleChoiceField {
        return new Fields.MultipleChoiceField(field.name, field.value);
    }

    private mapNumberField(field: FieldContracts.IFieldContract): Fields.NumberField {
        return new Fields.NumberField(field.name, field.value);
    }

    private mapTextField(field: FieldContracts.IFieldContract): Fields.TextField {
        return new Fields.TextField(field.name, field.value);
    }

    private mapAssetsField(field: FieldContracts.IFieldContract): Fields.AssetsField {
        return new Fields.AssetsField(field.name, field.value);
    }

    private mapTaxonomyField(field: FieldContracts.IFieldContract): Fields.TaxonomyField {
        return new Fields.TaxonomyField(field.name, field.value, field.taxonomy_group);
    }

    private mapCustomField(field: FieldContracts.IFieldContract, contentType: string): Fields.CustomField | FieldModels.IField {
        // try to find field resolver
        if (this.config.fieldResolver) {
            const customModel = this.config.fieldResolver(contentType, field.name, field.value);

            if (customModel) {
                return customModel;
            }

        }
        return new Fields.CustomField(field.name, field.value);
    }

    private mapUrlSlugField(field: FieldContracts.IFieldContract, item: ContentItem, queryConfig: IItemQueryConfig): Fields.UrlSlugField {
        const linkResolver = this.getLinkResolverForUrlSlugField(item, queryConfig);

        return new Fields.UrlSlugField(
            field.name,
            field.value,
            {
                resolveLink: () => urlSlugResolver.resolveUrl({
                    fieldName: field.name,
                    type: field.type,
                    fieldValue: field.value,
                    item: item,
                    enableAdvancedLogging: this.config.enableAdvancedLogging ? this.config.enableAdvancedLogging : false,
                    linkResolver: linkResolver
                })
            });
    }

    private mapLinkedItemsField(field: FieldContracts.IFieldContract, modularContent: any, queryConfig: IItemQueryConfig, processedItems: ContentItem[]): ContentItem[] {
        if (!field) {
            if (this.config.enableAdvancedLogging) {
                console.warn(`Cannot map linked item field because field does not exist. This warning can be turned off by disabling 'enableAdvancedLogging' option.`);
            }
            return [];
        }

        if (!field.value) {
            if (this.config.enableAdvancedLogging) {
                console.warn(`Cannot map linked item of '${field.name}' because its value does not exist. This warning can be turned off by disabling 'enableAdvancedLogging' option.`);
            }
            return [];
        }

        // result is always an array of content items
        const result: ContentItem[] = [];

        // value = array of item codenames
        const linkedItemCodenames = field.value as string[];
        linkedItemCodenames.forEach(codename => {
            const linkedItem = this.getOrSaveLinkedItem(codename, field, queryConfig, modularContent, processedItems);
            if (linkedItem) {
                // add item to result
                result.push(linkedItem);
            } else {
                // item was not found
                if (this.config.enableAdvancedLogging) {
                    // tslint:disable-next-line:max-line-length
                    console.warn(`Linked item with codename '${codename}' in linked items field '${field.name}' of '${field.type}' type could not be found. If you require this item, consider increasing 'depth' of your query. This warning can be turned off by disabling 'enableAdvancedLogging' option.`);
                }
            }
        });

        return result;
    }

    private getLinkResolverForUrlSlugField(item: ContentItem, queryConfig: IItemQueryConfig): ((link: Link, context: ILinkResolverContext) => string | undefined | ILinkResolverResult) | undefined {
        // link resolver defined by the query config (= by calling method) has priority over type's global link resolver
        let linkResolver: ((value: Link, context: ILinkResolverContext) => string | undefined | ILinkResolverResult) | undefined = undefined;

        if (queryConfig.linkResolver) {
            linkResolver = queryConfig.linkResolver;
        } else {
            linkResolver = item.linkResolver;
        }

        return linkResolver;
    }

    private getOrSaveLinkedItem(codename: string, field: FieldContracts.IFieldContract, queryConfig: IItemQueryConfig, modularContent: any, processedItems: ContentItem[]): ContentItem | undefined {
        // first check if item was already resolved and return it if it was
        const existingItem = processedItems.find(m => m.system.codename === codename);
        if (existingItem) {
            return existingItem;
        }

        const rawItem = modularContent[codename] as ItemContracts.IContentItemContract | undefined;

        // by default errors are not thrown
        let throwErrorForMissingLinkedItems: boolean = false;

        // check if errors should be thrown for missing linked items
        if (queryConfig.throwErrorForMissingLinkedItems === false || queryConfig.throwErrorForMissingLinkedItems === true) {
            // variable is a boolean
            throwErrorForMissingLinkedItems = queryConfig.throwErrorForMissingLinkedItems;
        }

        // throw error if item is not in response and errors are not skipped
        if (!rawItem) {
            const msg = `Linked item with codename '${codename}' could not be found in Delivery response.
            This linked item was requested by '${field.name}' field of '${field.type}'.
            Error can usually be solved by increasing 'Depth' parameter of your query.
            Alternatively, you may prevent this error by disabling 'throwErrorForMissingLinkedItems' in query configuration.`;

            if (throwErrorForMissingLinkedItems) {
                throw Error(msg);
            }
        }

        if (!rawItem) {
            // nothing else to do when item is not in response
            return undefined;
        }

        let mappedLinkedItem: ContentItem | undefined;

        // try resolving item using custom item resolver if its set
        if (queryConfig.itemResolver) {
            const customMappedItem = queryConfig.itemResolver(field, rawItem, modularContent, queryConfig);

            if (customMappedItem) {
                // if user used custom mapping, make sure to add 'system' and 'elements' properties to result
                customMappedItem.system = stronglyTypedResolver.mapSystemAttributes(rawItem.system);
                customMappedItem.elements = rawItem.elements;
                mappedLinkedItem = customMappedItem;
            }
        }

        // original resolving if item is still undefined
        if (!mappedLinkedItem) {
            mappedLinkedItem = this.mapFields(rawItem, modularContent, queryConfig, processedItems);
        }

        // add to processed items
        processedItems.push(mappedLinkedItem);
        return mappedLinkedItem;
    }

    private mapRichTextLinks(linksJson: any): Link[] {
        const links: Link[] = [];

        for (const linkItemId of Object.keys(linksJson)) {
            const linkRaw: ItemContracts.ILinkContract = linksJson[linkItemId] as ItemContracts.ILinkContract;
            links.push(new Link({
                codename: linkRaw.codename,
                itemId: linkItemId,
                urlSlug: linkRaw.url_slug,
                type: linkRaw.type,
            }));
        }

        return links;
    }
}
