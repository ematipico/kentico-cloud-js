const assert = require('assert');
const KenticoCloud = require('../../_commonjs');

const linkContexts = {};

class Actor extends KenticoCloud.ContentItem {

    constructor() {
        super({
            richTextResolver: (item, context) => {
                return `<p>${item.first_name.text}</p>`;
            },
            linkResolver: (link, context) => {
                linkContexts[link.codename] = context;
                return {
                    asHtml: `<test>${link.urlSlug}</test>`
                }
            }
        });
    }
}

class Movie extends KenticoCloud.ContentItem {

    constructor() {
        super({
            propertyResolver: (fieldName) => {
                if (fieldName === 'releasecategory') {
                    return 'releaseCategory';
                }
            },
            richTextResolver: (item, context) => {
                return `<p>${item.title.text}</p>`;
            }
        }, );
    }
}

const movieCodename = 'warrior';

const deliveryClient = new KenticoCloud.DeliveryClient({
    projectId: 'da5abe9f-fdad-4168-97cd-b3464be2ccb9',
    typeResolvers: [
        new KenticoCloud.TypeResolver('movie', () => new Movie()),
        new KenticoCloud.TypeResolver('actor', () => new Actor())
    ],
});

describe('#Rich text field with HTML links', () => {

    let plot; // resolved plot (rich text)

    const expectedLinkHtmlA = `<test>joel-edgerton</test>`;
    const expectedLinkHtmlB = `<test>tom-hardy</test>`;

    before((done) => {
        deliveryClient.item(movieCodename)
        .getObservable()
            .subscribe(response => {
                result = response;

                plot = response.item.plot.getHtml();
                console.log(plot);
                done();
            });
    });
 
    it('Rich text should contain expected resolved HTML link A', () => {
        assert.ok(plot.includes(expectedLinkHtmlA));
    });

    it('Rich text should contain expected resolved HTML link B', () => {
        assert.ok(plot.includes(expectedLinkHtmlB));
    });

    it('Links in rich text should have context along with original link text', () => {
        assert.ok(plot.includes(expectedLinkHtmlB));

        const joelLink = linkContexts['joel_edgerton'];
        const tomLink = linkContexts['tom_hardy'];

        assert.ok(joelLink);
        if (joelLink) {
            assert.equal(joelLink.linkText, 'Joel Edgerton');
        }

        assert.ok(tomLink);
        if (tomLink) {
            assert.equal(tomLink.linkText, 'Tom Hardy');
        }
    });

});
