var generateSchema = require('json-schema-generator');

var getSchema = module.exports = function(res) {
	if (res.type === 'Documentation' || res.type === 'Remittance'
			|| res.type === 'User' || res.type === 'Test'
			|| res.type === 'SupportingDocumentation') {
		return {};
	}
	var filename = '../schemas/examples/' + res.type.toLowerCase();
	if (res.type === 'Medication') {
		filename += '-example-f002-crestor.json';
	} else if (res.type === 'MedicationAdministration'
			|| res.type === 'MedicationOrder'
			|| res.type === 'MedicationStatement'
			|| res.type === 'MedicationDispense') {
		filename += 'example1.json';
	} else if (res.type === 'NutritionOrder') {
		filename += '-example-cardiacdiet.json';
	} else if (res.type === 'Patient') {
		filename += '-example-a.json';
	} else if (res.type === 'RelatedPerson') {
		filename += '-example-peter.json';
	} else if (res.type === 'CompartmentDefinition') {
		filename += '-patient.json';
	} else if (res.type === 'Measure') {
		filename += '-exclusive-breastfeeding.json';
	} else if (res.type === 'MeasureReport') {
		filename += '-cms146-cat1-example.json';
	} else {
		filename += '-example.json';
	}
	var example = require(filename);
	return generateSchema(example);
}
