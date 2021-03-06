import {
    IFeaturedObjects,
    IHtmlResolverConfig,
    ILinkObject,
    ILinkedItemContentObject,
    IRichTextHtmlParser,
    IRichTextReplacements,
    IRichTextResolverResult,
} from '../parse-models';
import { ILinkResolverResult } from '../../interfaces';
import { RichTextContentType } from '../../enums';

export class BrowserRichTextParser implements IRichTextHtmlParser {

    private readonly linkedItemWrapperElem = 'div';

    private readonly modularContentElementData = {
        type: 'application/kenticocloud',
        dataType: 'data-type',
        dataCodename: 'data-codename'
    };

    private readonly link = {
        nodeName: 'a',
        dataItemId: 'data-item-id',
    };

    resolveRichTextField(html: string, replacement: IRichTextReplacements, config: IHtmlResolverConfig): IRichTextResolverResult {
        try {
            const doc = this.createWrapperElement(html);

            // get all linked items
            const result = this.processRichTextField(doc.children, replacement, config, {
                links: [],
                linkedItems: []
            });

            return {
                links: result.links,
                linkedItems: result.linkedItems,
                resolvedHtml: doc.innerHTML
            };

        } catch (error) {
            throw Error('Parsing HTML failed:' + error);
        }
    }

    private createWrapperElement(html: string): HTMLDivElement {
        const element = document.createElement(this.linkedItemWrapperElem);
        element.innerHTML = html;

        return element;
    }

    private processRichTextField(htmlCollection: HTMLCollection, replacement: IRichTextReplacements, config: IHtmlResolverConfig, result: IFeaturedObjects): IFeaturedObjects {
        if (!htmlCollection || htmlCollection.length === 0) {
            // there are no more nodes
        } else {
            // extract objects
            for (let i = 0; i < htmlCollection.length; i++) {
                const element = htmlCollection[i];
                const typeAttribute = element.attributes ? element.attributes.getNamedItem('type') : undefined;
                if (element.attributes && typeAttribute && typeAttribute.value && typeAttribute.value.toLowerCase() === this.modularContentElementData.type.toLowerCase()) {
                    // node is modular content object
                    const dataCodenameAttribute = element.attributes.getNamedItem(this.modularContentElementData.dataCodename);
                    const dataTypeAttribute = element.attributes.getNamedItem(this.modularContentElementData.dataType);

                    if (!dataTypeAttribute) {
                        throw Error('Missing data type attribute. This is likely an error caused by invalid response.');
                    }

                    const linkItemContentObject: ILinkedItemContentObject = {
                        dataCodename: dataCodenameAttribute ? dataCodenameAttribute.value : '',
                        dataType: dataTypeAttribute ? dataTypeAttribute.value : ''
                    };

                    // add to result
                    result.linkedItems.push(linkItemContentObject);

                    // replace html
                    const parentElement = element.parentElement;

                    if (!parentElement) {
                        console.warn(`Could not replace linked item '${linkItemContentObject.dataCodename}' of '${linkItemContentObject.dataType}' because parent node is undefined. Please report this error if you are seeing this.`);
                    } else {
                        // create new element
                        const newElem = document.createElement(config.linkedItemWrapperTag);

                        // get type of resolving item
                        let type: RichTextContentType | undefined;
                        if (dataTypeAttribute.value === 'item') {
                            type = RichTextContentType.Item;
                        } else {
                            throw Error(`Unknown data type '${type}' found in rich text field.`);
                        }

                        newElem.innerHTML = replacement.getLinkedItemHtml(linkItemContentObject.dataCodename, type);

                        // add classes
                        newElem.className = config.linkedItemWrapperClasses.map(m => m).join(' ');

                        // replace original node with new one
                        parentElement.replaceChild(newElem, element);
                    }
                }

                if (element.nodeName.toLowerCase() === this.link.nodeName.toLowerCase()) {
                    const dataItemIdAttribute = element.attributes.getNamedItem(this.link.dataItemId);

                    if (dataItemIdAttribute) {
                        const link: ILinkObject = {
                            dataItemId: dataItemIdAttribute ? dataItemIdAttribute.value : ''
                        };

                        // add to result
                        result.links.push(link);

                        // get original link text (the one inside <a> tag)
                        const linkText = element.innerHTML;

                        const linkResult = replacement.getLinkResult(link.dataItemId, linkText);
                        let useResultAsUrl: boolean = true;

                        if (typeof linkResult === 'string' ) {
                            // use result as URL
                            useResultAsUrl = true;
                        } else {
                            useResultAsUrl = false;
                        }

                        if (!useResultAsUrl) {
                            // replace whole link (<a> tag)
                            if (linkResult) {
                                // html for link is defined
                                const linkHtml = (<ILinkResolverResult>linkResult).asHtml;
                                element.outerHTML = linkHtml ? linkHtml : '';
                                const parent = element.parentNode;
                                if (parent) {
                                    parent.replaceChild(element, element);
                                }
                            }
                        }

                        if (useResultAsUrl) {
                            // add url to link
                            const hrefAttribute = element.attributes.getNamedItem('href');
                            if (!hrefAttribute) {
                                // href attribute is missing
                                if (config.enableAdvancedLogging) {
                                    console.warn(`Cannot set url '${linkResult}' because 'href' attribute is not present in the <a> tag. Please report this issue if you are seeing this. This warning can be turned off by disabling 'enableAdvancedLogging' option.`);
                                }
                            } else {
                                // get link url
                                const linkUrlResult: string | undefined = typeof linkResult === 'string' ? <string>linkResult : (<ILinkResolverResult>linkResult).asUrl;
                                hrefAttribute.value = linkUrlResult ? linkUrlResult : '';
                            }
                        }

                    }
                }

                // recursively process child nodes
                if (element.children && element.children.length > 0) {
                    this.processRichTextField(element.children, replacement, config, result);
                }
            }
        }

        return result;
    }
}

