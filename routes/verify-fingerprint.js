const express = require('express');
const { convertToJson, xmlToJson } = require('../helpers/xml');
const validator = require('./middleware/validate-verify-fingerprint');
const shortid = require('shortid')
const Knex = require('knex')
const knexfile = require('../knexfile')

const knex = Knex(knexfile.development)

module.exports = (soapRequest) => {

  const router = express.Router();
  router.post('/', validator, ({ body }, response, next) => {
    (async () => {
      const { nin, template, fingerCode } = body;
      const payload = 
      `
      <Payload>
        <NIN>${nin}</NIN>
        <FINGERIMAGE>${template}</FINGERIMAGE>
        <FINGERCODE>${fingerCode}</FINGERCODE>
      </Payload>
      `;
      
      const log = {
        id: shortid.generate(),
        finger: fingerCode,
        timestamp: new Date().getTime(),
        nin: nin
      }

      return soapRequest.execute('BiometricVerification', payload)
        .then(async result => {
          log.requestTime = new Date().getTime() - log.timestamp
          log.code = result.code
          log.transId = result.id || ''
          log.responseXml = result.payload || ''

          if(result.code === '00') {
            //Finger print match was successfull
            const json = await convertToJson(result.payload, getMapping());
            
            const data = {
              id: result.id,
              code: result.code,
              profile: json
            }
            response.json(data);
            log.responseJson =  JSON.stringify(data)
          } else if (result.code === '141') {
            const json = await xmlToJson(result.payload)
            const fingers = json.NidaReponse && json.NidaReponse.Fingerprints ? 
              json.NidaReponse.Fingerprints.split('|').map(i => i.trim())
              : []
            const data = {
              id: result.id,
              code: result.code,
              fingers
            }
            response.json(data)
            log.responseJson = JSON.stringify(data)
          } else {
            log.responseJson = ''

            response.json({
              id: result.id,
              code: result.code
            });
          }

          await knex.table('event_log')
            .insert(log)
            .catch(error => {
              console.log('failed to log event', error)
            })
        })
    })().catch(next);
  });
  
  return router;
};

function getMapping() {
  return {
    FIRSTNAME: 'firstName',
    MIDDLENAME: 'middleName',
    SURNAME: 'lastName',
    OTHERNAMES: 'otherNames',
    SEX: 'sex',
    DATEOFBIRTH: 'dateOfBirth',
    PLACEOFBIRTH: 'placeOfBirth',
    RESIDENTREGION: 'residentRegion',
    RESIDENTDISTRICT: 'residentDistrict',
    RESIDENTWARD: 'residentWard',
    RESIDENTVILLAGE: 'residentVillage',
    RESIDENTSTREET: 'residentStreet',
    RESIDENTHOUSENO: 'residentHouseNo',
    RESIDENTPOSTALADDRESS: 'residentPostalAddress',
    RESIDENTPOSTCODE: 'residentPostCode',
    BIRTHCOUNTRY: 'birthCountry',
    BIRTHREGION: 'birthRegion',
    BIRTHDISTRICT: 'birthDistrict',
    BIRTHWARD: 'birthWard',
    BIRTHCERTIFICATENO: 'birthCertificateNo',
    NATIONALITY: 'nationality',
    PHONENUMBER: 'phoneNumber',
    PHOTO: 'photo',
    SIGNATURE: 'signature'
  };
}