#!/usr/bin/env python
"""
Comprehensive test runner for all serializer tests.
Usage: python manage.py test or_managements.tests.run_serializer_tests
"""
import unittest
from django.test.runner import DiscoverRunner
from django.conf import settings
from django.test.utils import setup_test_environment, teardown_test_environment

from .serializers.test_instrument_serializer import InstrumentSerializerTestCase
from .serializers.test_rfid_tag_serializer import RFIDTagSerializerTestCase
from .serializers.test_operation_session_serializer import OperationSessionSerializerTestCase


def suite():
    """Build a test suite of all serializer tests"""
    test_suite = unittest.TestSuite()
    
    # Add all serializer test cases
    test_suite.addTest(unittest.makeSuite(InstrumentSerializerTestCase))
    test_suite.addTest(unittest.makeSuite(RFIDTagSerializerTestCase))
    test_suite.addTest(unittest.makeSuite(OperationSessionSerializerTestCase))
    
    # Additional serializer test cases can be added here as they're created
    
    return test_suite


class SerializerTestRunner(DiscoverRunner):
    """Custom test runner for serializer tests"""
    
    def run_tests(self, test_labels, extra_tests=None, **kwargs):
        """Run the serializer test suite"""
        setup_test_environment()
        
        # Get the test suite
        test_suite = suite()
        
        # Run the tests
        runner = unittest.TextTestRunner()
        result = runner.run(test_suite)
        
        teardown_test_environment()
        
        # Return the number of failures to determine exit code
        return len(result.failures) + len(result.errors)


if __name__ == '__main__':
    # This allows the test file to be run directly
    runner = SerializerTestRunner()
    failures = runner.run_tests(["or_managements.tests.serializers"])
    exit(bool(failures))
