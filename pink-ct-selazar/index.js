import csv from 'csv-parser';
import fs from 'fs';
import fetch from 'node-fetch';
import converter from 'json-2-csv';

const CT_TOKEN = '';
const apiUrl = 'https://api.sphere.io';
const project = 'thomas-pink-live';
const UK_CHANNEL = '7e8a416e-bc5f-4331-8488-8e320e9056c6';
const CHUNK_SIZE = 75;

const getProducts = async () => {
    return new Promise((resolve, reject) => {
        const products = [];
        const stream = fs.createReadStream('sku.data');
        const parser = stream.pipe(csv({ separator: ',' }));
        parser.on('data', (data) => products.push({ 'sku': data.sku, 'selazarQuantity': data.quantity }));
        parser.on('end', () => resolve(products));
    });
}

const getCtInventoryById = async (id) => {
    var url = `${apiUrl}/${project}/inventory/${id}`;
    var bearer = 'Bearer ' + CT_TOKEN;
    const response = await fetch(url, {
        method: 'GET',
        withCredentials: true,
        credentials: 'include',
        headers: {
            'Authorization': bearer,
            'Content-Type': 'application/json'
        }
    });
    const body = await response.text();
    if (body) {
        const inventory = JSON.parse(body);
        const {
            createdAt,
            lastModifiedAt,
            availableQuantity
        } = inventory;
        return {
            createdAt,
            lastModifiedAt,
            availableQuantity
        };
    }
    return null;
}

const getVariantResult = async (variant, base) => {
    const inventoryDataForUk = await getCtInventoryById(variant.availability.channels[UK_CHANNEL].id);
    return {
        ...base,
        ctVariant: variant.sku,
        ctInventoryCreatedAtUk: inventoryDataForUk.createdAt,
        ctInventoryLastModifiedAtUk: inventoryDataForUk.lastModifiedAt,
        ctInventoryAvailableQuantityUk: inventoryDataForUk.availableQuantity,
    };
}

const getCtProductsBySku = async (skuList) => {
    const inSring = skuList.map((sku) => `"${sku}"`).join();
    var where = `masterData(current(variants(sku in(${inSring})) or masterVariant(sku in(${inSring}))))`;
    var url = `${apiUrl}/${project}/products?limit=500&where=${where}`;
    var bearer = 'Bearer ' + CT_TOKEN;

    const response = await fetch(url, {
        method: 'GET',
        withCredentials: true,
        credentials: 'include',
        headers: {
            'Authorization': bearer,
            'Content-Type': 'application/json'
        }
    });
    const body = await response.text();
    if (body) {
        const data = JSON.parse(body);
        if (data.total > 0) {
            return data.results;
        } else {
            console.log(`skus=${skuList} not found`);
        }
    } else {
        console.log(`skus=${skuList} not found`);
    }
    return null;
};

const getDataFromResult = async (sku, result) => {
    if (!result) {
        return null;
    }
    const masterVariant = result.masterData.current.masterVariant;
    const base = {
        ctProductCreatedAt: result.createdAt,
        ctProductLastModifiedAt: result.lastModifiedAt,
        ctMasterVariant: masterVariant.sku
    };
    if (sku === masterVariant.sku) {
        return await getVariantResult(masterVariant, base);
    } else {
        var variants = result.masterData.current.variants;
        var variant = variants.find((v) => sku === v.sku);
        if (variant) {
            return await getVariantResult(variant, base);
        }
    }
    return null;
}

const productNotFoundResult = (product) => ({
    ...product,
    ctProductCreatedAt: 'NOT FOUND IN CT',
    ctProductLastModifiedAt: null,
    ctMasterVariant: null,
    ctVariant: null,
    ctInventoryCreatedAtUk: null,
    ctInventoryLastModifiedAtUk: null,
    ctInventoryAvailableQuantityUk: null,
    areQuantitiesEqual: false
});

const lookupDataResult = (skuResultMap) => async (product) => {
    const currentResult = skuResultMap[product.sku];
    if(!currentResult){
        return productNotFoundResult(product);
    } else {
        const dataResult = await getDataFromResult(product.sku, currentResult);
        return {
            ...product,
            ...dataResult,
            areQuantitiesEqual: product.selazarQuantity == dataResult.ctInventoryAvailableQuantityUk,
        };
    }
}

const search = () => async (products) => {
    const skuList = products.map((product) => product.sku);
    const apiResult = await getCtProductsBySku(skuList);
    if(!apiResult){
        return products.map(productNotFoundResult);
    }
    const skuResultMap = {};
    apiResult.forEach(r => {
        const masterSku = r.masterData.current.masterVariant.sku;
        var variantsSku = r.masterData.current.variants.map(v => v.sku);
        skuResultMap[masterSku] = r;
        variantsSku.forEach(sku => {skuResultMap[sku] = r;} );
    });

    const lookupData = lookupDataResult(skuResultMap);

    const processes = products.map(lookupData);

    const results = await Promise.all(processes);
    return results;
};

const exportDoc = (data) => {
    let json2csvCallback = function (err, csv) {
        if (err) throw err;
        fs.writeFile((new Date()).getTime() + '.csv', csv, 'utf8', function (err) {
            if (err) {
                console.log('Some error occured - file either not saved or corrupted file saved.');
            } else {
                console.log('It\'s saved!');
            }
        });
    };

    converter.json2csv(data, json2csvCallback, {
        prependHeader: true
    });
};

const splitArray = (inputArray, chunkSize) => {
    const result = inputArray.reduce((resultArray, item, index) => { 
        const chunkIndex = Math.floor(index/chunkSize)
        if(!resultArray[chunkIndex]) {
          resultArray[chunkIndex] = []
        }
        resultArray[chunkIndex].push(item);
        return resultArray
      }, []);
    return result;
}

const main = async () => {
    const productsFromSelazar = await getProducts();
    const searchData = search();
    const productChunks = splitArray(productsFromSelazar, CHUNK_SIZE);

    const results = [];
    let currentChunk = 0;
    for(const products of productChunks){
        console.log(`chunk #: ${currentChunk++}`);
        const result = await searchData(products);
        results.push(result);
    }
    exportDoc(results.flat());
};

main();
