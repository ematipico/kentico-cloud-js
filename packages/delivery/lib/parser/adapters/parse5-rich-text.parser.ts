import {
    Attribute,
    DefaultTreeDocumentFragment,
    DefaultTreeElement,
    DefaultTreeTextNode,
    parseFragment,
    serialize,
} from 'parse5';

import { RichTextContentType } from '../../enums';
import { ILinkResolverResult } from '../../interfaces';
import {
    IFeaturedObjects,
    IHtmlResolverConfig,
    ILinkedItemContentObject,
    ILinkObject,
    IRichTextHtmlParser,
    IRichTextReplacements,
    IRichTextResolverResult,
} from '../parse-models';
import { parse5Utils } from './parse5utils';

export class Parse5RichTextParser implements IRichTextHtmlParser {

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
            // create document
            const documentFragment = parseFragment(html) as DefaultTreeDocumentFragment;

            // get all linked items
            const result = this.processRichTextField(this.getChildNodes(documentFragment), replacement, config, {
                links: [],
                linkedItems: []
            });

            const resolvedHtml = serialize(documentFragment);

            return {
                links: result.links,
                linkedItems: result.linkedItems,
                resolvedHtml: resolvedHtml
            };

        } catch (error) {
            throw Error('Parsing HTML failed:' + error);
        }
    }

    private processRichTextField(elements: DefaultTreeElement[], replacement: IRichTextReplacements, config: IHtmlResolverConfig, result: IFeaturedObjects): IFeaturedObjects {
        if (!elements || elements.length === 0) {
            // there are no more elements
        } else {
            elements.forEach(element => {
                if (element.attrs) {

                    // process modular content
                    this.processModularContent(element, replacement, config, result);

                    // process link
                    this.processLink(element, replacement, config, result);
                }

                if (element.childNodes) {
                    // recursively process all childs
                    this.processRichTextField(this.getChildNodes(element), replacement, config, result);
                }
            });
        }

        return result;
    }

    private processLink(element: DefaultTreeElement, replacement: IRichTextReplacements, config: IHtmlResolverConfig, result: IFeaturedObjects): void {
        const attributes = element.attrs;

        if (element.nodeName !== this.link.nodeName) {
            // node is not a link
            return;
        }

        // get all links which have item it attribute, ignore all other links (they can be regular links in rich text)
        const dataItemIdAttribute = attributes.find(m => m.name === this.link.dataItemId);
        if (!dataItemIdAttribute) {
            // its either a regular link or the attribute is not defined
            return;
        }

        // prepare link object
        const link: ILinkObject = {
            dataItemId: dataItemIdAttribute ? dataItemIdAttribute.value : ''
        };

        // add link to result
        result.links.push(link);

        // get original link text (the one inside <a> tag from response)
        let originalLinkText: string | undefined = undefined;

        const linkTextNode = element.childNodes[0] as DefaultTreeTextNode;
        if (linkTextNode) {
            originalLinkText = linkTextNode.value;
        }

        const linkResult = replacement.getLinkResult(link.dataItemId, originalLinkText || '');
        let useResultAsUrl: boolean = true;

        if (typeof linkResult === 'string') {
            // use result as URL
            useResultAsUrl = true;
        } else {
            useResultAsUrl = false;
        }

        if (useResultAsUrl) {
            // assign url to 'href' attribute of the link
            const hrefAttribute = attributes.find(m => m.name === 'href');
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

        if (!useResultAsUrl) {
            // replace whole link (<a> tag)
            if (linkResult) {
                // html for link is defined
                const linkHtml = (<ILinkResolverResult>linkResult).asHtml ? (<ILinkResolverResult>linkResult).asHtml : '';
                if (linkHtml) {
                    const newNode = parseFragment(parse5Utils.createTextNode(''), linkHtml);
                    parse5Utils.replaceNode(element, (newNode as any).childNodes[0]);
                }
            }
        }
    }

    private processModularContent(
        element: DefaultTreeElement,
        replacement: IRichTextReplacements,
        config: IHtmlResolverConfig,
        result: IFeaturedObjects): void {
        const attributes = element.attrs;

        const typeAttribute = attributes.find(m => m.value === this.modularContentElementData.type);
        if (!typeAttribute) {
            // node is not kentico cloud data type
            return;
        }

        const dataTypeAttribute = attributes.find(m => m.name === this.modularContentElementData.dataType);

        if (!dataTypeAttribute) {
            throw Error(`Object tag in rich text field is missing a data type attribute '${this.modularContentElementData.dataType}'`);
        }

        // get type of resolving item
        let type: RichTextContentType | undefined;
        if (dataTypeAttribute.value === 'item') {
            type = RichTextContentType.Item;
        } else {
            throw Error(`Unknown data type '${type}' found in rich text field response. `);
        }

        // get codename of the modular content
        const dataCodenameAttribute: Attribute | undefined = attributes.find(m => m.name === this.modularContentElementData.dataCodename);
        if (dataCodenameAttribute == null) {
            throw Error(`The '${this.modularContentElementData.dataCodename}' attribute is missing and therefore linked item cannot be retrieved`);
        }

        const itemCodename = dataCodenameAttribute.value;

        const linkedItem: ILinkedItemContentObject = {
            dataCodename: dataCodenameAttribute ? dataCodenameAttribute.value : '',
            dataType: dataTypeAttribute ? dataTypeAttribute.value : ''
        };

        // add to result
        result.linkedItems.push(linkedItem);

        // get html
        const resultHtml = replacement.getLinkedItemHtml(itemCodename, type);

        // replace 'object' tag name
        element.tagName = config.linkedItemWrapperTag;

        // add classes
        element.attrs.push({
            name: 'class',
            value: config.linkedItemWrapperClasses.map(m => m).join(' ')
        });

        // get serialized set of nodes from HTML
        const serializedChildNodes = parseFragment(resultHtml) as any;

        // add child nodes
        element.childNodes = serializedChildNodes.childNodes;
    }

    private getChildNodes(documentFragment: DefaultTreeElement | DefaultTreeDocumentFragment): DefaultTreeElement[] {
        return (documentFragment as DefaultTreeDocumentFragment).childNodes as DefaultTreeElement[];
    }

}

