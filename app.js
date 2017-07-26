var app = angular.module("app", [
	'angular-ui-query-builder'
]);

app.controller("queryBuilderExampleCtrl", function($scope) {
	$scope.spec = {
		_id: {type: 'objectId'},
		lastLogin: {type: 'date'},
		status: {type: 'string', enum: ['pending', 'active', 'approved', 'deleted']},
		role: {type: 'string', enum: ['user', 'admin', 'root']},
		name: {type: 'string'},
		email: {type: 'string'},
	};

	$scope.query = {
		email: {$exists: true},
		role: 'admin',
		status: {$in: ['active', 'approved']},
		/* FIXME: Not yet supported
		$and: [
			{role: 'admin'},
			{role: 'user', $exists: {email: true}},
		],
		*/
	};


	// FIXME: Rockjaw scenario
$scope.query =
{
  "cancelled": false,
  "status": {
    "$in": [
      "draft",
      "assignedLotNumber",
      "opened",
      "pendingClosureOnTestResults",
      "lotCompletionNotification"
    ]
  },
  "workPack": "1234",
};

$scope.spec =
{
  "_id": {
    "type": "objectid",
    "title": "Id"
  },
  "area": {
    "type": "string",
    "title": "Area"
  },
  "areaDescription": {
    "type": "string",
    "title": "Area Description"
  },
  "assets": {
    "type": "array",
    "default": "[DYNAMIC]",
    "title": "Assets"
  },
  "cancelReason": {
    "type": "string",
    "title": "Cancel Reason"
  },
  "cancelled": {
    "type": "boolean",
    "title": "Cancelled"
  },
  "code": {
    "type": "string",
    "title": "Code"
  },
  "constructionAreaPlan": {
    "type": "string",
    "title": "Construction Area Plan"
  },
  "created": {
    "type": "date",
    "default": "[DYNAMIC]",
    "title": "Created"
  },
  "createdBy": {
    "type": "objectid",
    "ref": "users",
    "title": "Created By"
  },
  "description": {
    "type": "string",
    "title": "Description"
  },
  "documentationConfirm.asBuiltSurvey": {
    "type": "string",
    "enum": [
      {
        "id": "absent",
        "title": "Absent"
      },
      {
        "id": "confirmed",
        "title": "Confirmed"
      },
      {
        "id": "notApplicable",
        "title": "Not Applicable"
      }
    ],
    "default": "absent",
    "title": "Documentation Confirm As Built Survey"
  },
  "documentationConfirm.completedInspectionAndTestPlans": {
    "type": "string",
    "enum": [
      {
        "id": "absent",
        "title": "Absent"
      },
      {
        "id": "confirmed",
        "title": "Confirmed"
      },
      {
        "id": "notApplicable",
        "title": "Not Applicable"
      }
    ],
    "default": "absent",
    "title": "Documentation Confirm Completed Inspection And Test Plans"
  },
  "documentationConfirm.completedVerificationChecklist": {
    "type": "string",
    "enum": [
      {
        "id": "absent",
        "title": "Absent"
      },
      {
        "id": "confirmed",
        "title": "Confirmed"
      },
      {
        "id": "notApplicable",
        "title": "Not Applicable"
      }
    ],
    "default": "absent",
    "title": "Documentation Confirm Completed Verification Checklist"
  },
  "documentationConfirm.inspectionReports": {
    "type": "string",
    "enum": [
      {
        "id": "absent",
        "title": "Absent"
      },
      {
        "id": "confirmed",
        "title": "Confirmed"
      },
      {
        "id": "notApplicable",
        "title": "Not Applicable"
      }
    ],
    "default": "absent",
    "title": "Documentation Confirm Inspection Reports"
  },
  "documentationConfirm.materialTestReports": {
    "type": "string",
    "enum": [
      {
        "id": "absent",
        "title": "Absent"
      },
      {
        "id": "confirmed",
        "title": "Confirmed"
      },
      {
        "id": "notApplicable",
        "title": "Not Applicable"
      }
    ],
    "default": "absent",
    "title": "Documentation Confirm Material Test Reports"
  },
  "documentationConfirm.other": {
    "type": "string",
    "enum": [
      {
        "id": "absent",
        "title": "Absent"
      },
      {
        "id": "confirmed",
        "title": "Confirmed"
      },
      {
        "id": "notApplicable",
        "title": "Not Applicable"
      }
    ],
    "default": "absent",
    "title": "Documentation Confirm Other"
  },
  "documentationConfirm.subContractorRecords": {
    "type": "string",
    "enum": [
      {
        "id": "absent",
        "title": "Absent"
      },
      {
        "id": "confirmed",
        "title": "Confirmed"
      },
      {
        "id": "notApplicable",
        "title": "Not Applicable"
      }
    ],
    "default": "absent",
    "title": "Documentation Confirm Sub Contractor Records"
  },
  "documentationConfirm.supplierRecords": {
    "type": "string",
    "enum": [
      {
        "id": "absent",
        "title": "Absent"
      },
      {
        "id": "confirmed",
        "title": "Confirmed"
      },
      {
        "id": "notApplicable",
        "title": "Not Applicable"
      }
    ],
    "default": "absent",
    "title": "Documentation Confirm Supplier Records"
  },
  "documents": {
    "type": "array",
    "default": "[DYNAMIC]",
    "title": "Documents"
  },
  "edited": {
    "type": "date",
    "title": "Edited"
  },
  "editedBy": {
    "type": "objectid",
    "ref": "users",
    "title": "Edited By"
  },
  "holdWitnessPoints": {
    "type": "array",
    "default": "[DYNAMIC]",
    "title": "Hold Witness Points"
  },
  "lot.cableType": {
    "type": "string",
    "enum": [
      {
        "id": "commsCabinet",
        "title": "Comms Cabinet"
      },
      {
        "id": "none",
        "title": "None"
      },
      {
        "id": "sourceLocation",
        "title": "Source Location"
      }
    ],
    "default": "sourceLocation",
    "title": "Lot Cable Type"
  },
  "lot.chainageFrom": {
    "type": "number",
    "title": "Lot Chainage From"
  },
  "lot.chainageTo": {
    "type": "number",
    "title": "Lot Chainage To"
  },
  "lot.controlLine": {
    "title": "Lot Control Line"
  },
  "lot.designLot": {
    "type": "string",
    "title": "Lot Design Lot"
  },
  "lot.location": {
    "title": "Lot Location"
  },
  "lot.type": {
    "type": "string",
    "enum": [
      {
        "id": "linear",
        "title": "Linear"
      },
      {
        "id": "location",
        "title": "Location"
      },
      {
        "id": "none",
        "title": "None"
      }
    ],
    "default": "linear",
    "title": "Lot Type"
  },
  "ncr": {
    "type": "objectid",
    "ref": "ncrs",
    "title": "Ncr"
  },
  "process": {
    "type": "string",
    "title": "Process"
  },
  "processDescription": {
    "type": "string",
    "title": "Process Description"
  },
  "responsibleEngineer": {
    "type": "objectid",
    "ref": "users",
    "title": "Responsible Engineer"
  },
  "reviewedStatus": {
    "type": "string",
    "enum": [
      {
        "id": "ICAccepted",
        "title": "IC Accepted"
      },
      {
        "id": "ICIssued",
        "title": "IC Issued"
      },
      {
        "id": "ICReviewed",
        "title": "IC Reviewed"
      },
      {
        "id": "notReviewed",
        "title": "Not Reviewed"
      }
    ],
    "default": "notReviewed",
    "title": "Reviewed Status"
  },
  "status": {
    "type": "string",
    "enum": [
      {
        "id": "assignedLotNumber",
        "title": "Assigned Lot Number"
      },
      {
        "id": "closed",
        "title": "Closed"
      },
      {
        "id": "draft",
        "title": "Draft"
      },
      {
        "id": "lotCompletionNotification",
        "title": "Lot Completion Notification"
      },
      {
        "id": "opened",
        "title": "Opened"
      },
      {
        "id": "pendingClosureOnTestResults",
        "title": "Pending Closure On Test Results"
      }
    ],
    "default": "draft",
    "title": "Status"
  },
  "subProcess": {
    "type": "string",
    "title": "Sub Process"
  },
  "subProcessDescription": {
    "type": "string",
    "title": "Sub Process Description"
  },
  "type": {
    "type": "string",
    "enum": [
      {
        "id": "assets",
        "title": "Assets"
      },
      {
        "id": "cables",
        "title": "Cables"
      }
    ],
    "default": "assets",
    "title": "Type"
  },
  "workPack": {
    "type": "string",
    "title": "Work Pack"
  },
  "workType": {
    "type": "string",
    "enum": [
      {
        "id": "permanent",
        "title": "Permanent"
      },
      {
        "id": "temporary",
        "title": "Temporary"
      }
    ],
    "default": "permanent",
    "title": "Work Type"
  },
  "$prototype": {
    "documentationConfirm": {
      "asBuiltSurvey": "absent",
      "completedInspectionAndTestPlans": "absent",
      "completedVerificationChecklist": "absent",
      "inspectionReports": "absent",
      "materialTestReports": "absent",
      "other": "absent",
      "subContractorRecords": "absent",
      "supplierRecords": "absent"
    },
    "lot": {
      "cableType": "sourceLocation",
      "type": "linear"
    },
    "reviewedStatus": "notReviewed",
    "status": "draft",
    "type": "assets",
    "workType": "permanent",
    "title": "Prototype"
  }
};
});
